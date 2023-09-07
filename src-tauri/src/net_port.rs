use std::net::IpAddr;
use std::str;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use log::{debug, error, info, warn};
use message_io::network::{Endpoint, SendStatus, Transport};
use message_io::node::NodeHandler;
use sensor_core::{DisplayConfig, RenderData, SensorValue, TransportMessage, TransportType};

use crate::config::NetworkDeviceConfig;
use crate::{conditional_image, sensor, static_image, text, utils};

const PUSH_RATE: Duration = Duration::from_millis(1000);
const NETWORK_PORT: u64 = 10489;

/// Opens a tcp socket to the specified address
pub fn open(net_port_config: &NetworkDeviceConfig) -> Option<(NodeHandler<()>, Endpoint)> {
    let (handler, _listener) = message_io::node::split::<()>();
    let tcp_endpoint = connect_to_tcp_socket(net_port_config, &handler);

    tcp_endpoint.map(|endpoint| (handler, endpoint))
}

/// Establishes a tcp connection to the specified address
fn connect_to_tcp_socket(
    net_port_config: &NetworkDeviceConfig,
    handler: &NodeHandler<()>,
) -> Option<Endpoint> {
    let ip = resolve_hostname(&net_port_config.address);

    if ip.is_none() {
        error!("Could not resolve hostname {}", net_port_config.address);
    }

    let address = format!("{}:{NETWORK_PORT}", ip.unwrap());

    info!(
        "Connecting to device {}({})",
        net_port_config.name, &address
    );

    // Blocks until the connection is established
    let endpoint = handler
        .network()
        .connect_sync(Transport::FramedTcp, &address);

    // If not ok, print error and return none
    match endpoint {
        Ok(endpoint) => {
            info!("Connected to device {}({})", net_port_config.name, &address);

            let mut net_port = (handler.clone(), endpoint.0);
            prepare_static_data(net_port_config, &mut net_port);

            Some(endpoint.0)
        }
        Err(_err) => {
            error!(
                "Could not connect to device {}({})",
                net_port_config.name, &address
            );
            None
        }
    }
}

/// Prepares the static data.
/// This sends the static image data and the conditional image data to the remote tcp socket.
fn prepare_static_data(
    net_port_config: &NetworkDeviceConfig,
    net_port: &mut (NodeHandler<()>, Endpoint),
) {
    // Prepare text data
    prepare_static_text_data_on_display(net_port_config, net_port);

    // Prepare static image data
    prepare_static_image_data_on_display(net_port_config, net_port);

    // Prepare conditional image data
    prepare_conditional_image_data_on_display(net_port_config, net_port);

    // Wait 1 seconds for the assets to be loaded
    info!("Waiting 1s for assets to be loaded...");
    thread::sleep(Duration::from_secs(1));
}

/// Resolves the name of the device to an ip v4 address
fn resolve_hostname(address: &str) -> Option<String> {
    // Check if target string is an valid ip address
    if IpAddr::from_str(address).is_ok() {
        return Some(address.to_string());
    }

    // Otherwise we most likely have a hostname, try to resolve the hostname
    // and get the first ipv4 address
    return match dns_lookup::lookup_host(address).ok() {
        Some(ips) => ips
            .iter()
            .filter(|ip| ip.is_ipv4())
            .map(|ip| ip.to_string())
            .next(),
        None => {
            error!("Could not resolve hostname {}", address);
            None
        }
    };
}

/// Starts a new thread that writes to the remote tcp socket.
/// Returns a handle to the thread.
/// The thread will be stopped when the port_running_state_handle is set to false.
/// The thread will be joined when the handle is dropped.
pub fn start_sync(
    sensor_value_history: &Arc<Mutex<Vec<Vec<SensorValue>>>>,
    static_sensor_values: &Arc<Vec<SensorValue>>,
    net_port_config: NetworkDeviceConfig,
    port_running_state_handle: Arc<Mutex<bool>>,
) -> Arc<thread::JoinHandle<()>> {
    let static_sensor_values = static_sensor_values.clone();
    let sensor_value_history = sensor_value_history.clone();

    // Start new thread that writes to the remote tcp socket
    let handle = thread::spawn(move || {
        // Try to open the named network port
        let mut net_port = match try_open_tcp_socket(&net_port_config, &port_running_state_handle) {
            Some(value) => value,
            None => return,
        };

        // Send data until the port_running_state_handle is set to false (sync button in UI)
        while *port_running_state_handle.lock().unwrap() {
            // Measure duration
            let start_time = Instant::now();

            // Read sensor values
            let last_sensor_values =
                sensor::read_all_sensor_values(&sensor_value_history, &static_sensor_values);

            // Serialize the transport struct to bytes using messagepack
            let data_to_send =
                serialize_render_data(net_port_config.display_config.clone(), last_sensor_values);

            // Send to actual data to the remote tcp socket
            send_tcp_data(&net_port_config, &mut net_port, data_to_send);

            // Wait for the next iteration
            wait(start_time);
        }

        // Wait for thread to be joined
        thread::park();
    });

    Arc::new(handle)
}

/// Tries to open the tcp socket until the port_running_state_handle is set to false.
/// Returns a tcp handler and tcp listener
fn try_open_tcp_socket(
    net_port_config: &NetworkDeviceConfig,
    port_running_state_handle: &Arc<Mutex<bool>>,
) -> Option<(NodeHandler<()>, Endpoint)> {
    let mut net_port = None;

    while *port_running_state_handle.lock().unwrap() && net_port.is_none() {
        // Wait 1 seconds before trying to open the port again
        thread::sleep(Duration::from_secs(1));

        // Try to open the named network port
        net_port = open(net_port_config);
    }
    net_port.as_ref()?;

    net_port
}

/// Prepares the render data for the remote tcp socket
fn prepare_static_text_data_on_display(
    net_port_config: &NetworkDeviceConfig,
    net_port: &mut (NodeHandler<()>, Endpoint),
) {
    let text_data = text::get_preparation_data(&net_port_config.display_config);
    let data_to_send = text::serialize(text_data);
    send_tcp_data(net_port_config, net_port, data_to_send);
}

/// Prepares the render data for the remote tcp socket
fn prepare_static_image_data_on_display(
    net_port_config: &NetworkDeviceConfig,
    net_port: &mut (NodeHandler<()>, Endpoint),
) {
    let static_image_data = static_image::get_preparation_data(&net_port_config.display_config);
    let data_to_send = static_image::serialize(static_image_data);
    send_tcp_data(net_port_config, net_port, data_to_send);
}

/// Prepares the conditional image data and sends it to the remote tcp socket
fn prepare_conditional_image_data_on_display(
    net_port_config: &NetworkDeviceConfig,
    net_port: &mut (NodeHandler<()>, Endpoint),
) {
    let conditional_image_data =
        conditional_image::get_preparation_data(&net_port_config.display_config);
    let data_to_send = conditional_image::serialize_preparation_data(conditional_image_data);
    send_tcp_data(net_port_config, net_port, data_to_send);
}

/// Sends the data to the remote tcp socket
fn send_tcp_data(
    net_port_config: &NetworkDeviceConfig,
    net_port: &mut (NodeHandler<()>, Endpoint),
    data_to_send: Vec<u8>,
) {
    // Log data to send
    let data_len = utils::pretty_bytes(data_to_send.len());
    info!(
        "Sending data {} {} to '{}'...",
        data_len.0, data_len.1, net_port_config.name
    );

    // Send the actual data via TCP
    let send_status: SendStatus = net_port.0.network().send(net_port.1, &data_to_send);

    // Handle response status
    match send_status {
        SendStatus::MaxPacketSizeExceeded => {
            error!(" MaxPacketSizeExceeded")
        }
        SendStatus::Sent => {
            info!(" Successfully")
        }
        SendStatus::ResourceNotFound => {
            warn!(" Not found --> Reconnecting");
            // Connection was lost, try to reconnect
            *net_port = match open(net_port_config) {
                Some((handler, endpoint)) => (handler, endpoint),
                None => {
                    return;
                }
            };
        }
        SendStatus::ResourceNotAvailable => {
            warn!(" Not available --> Reconnecting");
            // Connection failed, try to reconnect
            *net_port = match open(net_port_config) {
                Some((handler, endpoint)) => (handler, endpoint),
                None => {
                    return;
                }
            }
        }
    }
}

/// Serializes the sensor values and display config to a transport message.
/// The transport message is then serialized to a byte vector.
/// The byte vector is then sent to the remote tcp socket.
fn serialize_render_data(
    display_config: DisplayConfig,
    last_sensor_values: Vec<SensorValue>,
) -> Vec<u8> {
    // Serialize data to render
    let render_data = RenderData {
        display_config,
        sensor_values: last_sensor_values,
    };
    let render_data = bincode::serialize(&render_data).unwrap();

    // Serialize transport message
    let transport_message = TransportMessage {
        transport_type: TransportType::RenderImage,
        data: render_data,
    };

    bincode::serialize(&transport_message).unwrap()
}

/// Waits for the remaining time of the update interval
/// To keep the PUSH_RATE at a constant rate, we need to sleep for the remaining time - the time it took to read the sensor values
/// and send them to the network tcp port
fn wait(start_time: Instant) {
    let processing_duration = Instant::now().duration_since(start_time);
    debug!("Processing duration: {:?}", processing_duration);
    let time_to_wait = PUSH_RATE
        .checked_sub(processing_duration)
        .unwrap_or_else(|| {
            error!("Warning: Processing duration is longer than the update interval");
            PUSH_RATE
        });
    thread::sleep(time_to_wait);
}

/// Verifies that the specified address is reachable
pub fn verify_network_address(address: &str) -> bool {
    let ip = resolve_hostname(address);

    if ip.is_none() {
        error!("Could not resolve hostname {}", address);
        return false;
    }

    // Pings the specified address
    check_ip(&ip.unwrap())
}

/// Pings the specified ip address
pub fn check_ip(ip: &str) -> bool {
    info!("Testing IP '{ip}' on TCP port '{NETWORK_PORT}'");

    let (handler, _) = message_io::node::split::<()>();
    let endpoint = handler
        .network()
        .connect_sync(Transport::FramedTcp, format!("{ip}:{NETWORK_PORT}"));

    endpoint.is_ok()
}
