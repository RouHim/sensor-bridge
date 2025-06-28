use std::net::IpAddr;
use std::str;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use log::{debug, error, info, warn};
use sensor_core::{DisplayConfig, RenderData, SensorValue, TransportMessage, TransportType};
use ureq::{Agent, AgentBuilder};

use crate::config::NetworkDeviceConfig;
use crate::{conditional_image, sensor, static_image, text, utils};

const PUSH_RATE: Duration = Duration::from_millis(1000);
const NETWORK_PORT: u64 = 10489;
const HTTP_TIMEOUT: Duration = Duration::from_secs(5);

// Custom type to represent HTTP connection
pub struct HttpEndpoint {
    address: String,
    agent: Agent,
}

/// Opens an HTTP connection to the specified address
pub fn open(net_port_config: &NetworkDeviceConfig) -> Option<HttpEndpoint> {
    let ip = resolve_hostname(&net_port_config.address);

    if ip.is_none() {
        error!("Could not resolve hostname {}", net_port_config.address);
        return None;
    }

    let address = format!("http://{}:{NETWORK_PORT}", ip.unwrap());

    info!(
        "Connecting to device {}({})",
        net_port_config.name, &address
    );

    // Create HTTP agent with timeouts
    let agent = AgentBuilder::new()
        .timeout_read(HTTP_TIMEOUT)
        .timeout_write(HTTP_TIMEOUT)
        .build();

    // Test connection
    match agent.get(&format!("{}/ping", address)).call() {
        Ok(_) => {
            info!("Connected to device {}({})", net_port_config.name, &address);

            let http_endpoint = HttpEndpoint { address, agent };

            prepare_static_data(net_port_config, &http_endpoint);

            Some(http_endpoint)
        }
        Err(err) => {
            error!(
                "Could not connect to device {}({}) - Error: {:?}",
                net_port_config.name, &address, err
            );
            None
        }
    }
}

/// Prepares the static data.
/// This sends the static image data and the conditional image data to the remote HTTP endpoint.
fn prepare_static_data(net_port_config: &NetworkDeviceConfig, http_endpoint: &HttpEndpoint) {
    // Prepare text data
    prepare_static_text_data_on_display(net_port_config, http_endpoint);

    // Prepare static image data
    prepare_static_image_data_on_display(net_port_config, http_endpoint);

    // Prepare conditional image data
    prepare_conditional_image_data_on_display(net_port_config, http_endpoint);

    // Wait 1 seconds for the assets to be loaded
    info!("Waiting 1s for assets to be processed by the display...");
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
    match dns_lookup::lookup_host(address).ok() {
        Some(ips) => ips
            .iter()
            .filter(|ip| ip.is_ipv4())
            .map(|ip| ip.to_string())
            .next(),
        None => {
            error!("Could not resolve hostname {}", address);
            None
        }
    }
}

/// Starts a new thread that sends data via HTTP.
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

    // Start new thread that writes data via HTTP
    let handle = thread::spawn(move || {
        // Try to open the HTTP connection
        let http_endpoint =
            match try_open_http_endpoint(&net_port_config, &port_running_state_handle) {
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

            // Send the actual data to the remote HTTP endpoint
            send_http_data(&net_port_config, &http_endpoint, data_to_send);

            // Wait for the next iteration
            wait(start_time);
        }

        // Wait for thread to be joined
        thread::park();
    });

    Arc::new(handle)
}

/// Tries to open the HTTP connection until the port_running_state_handle is set to false.
fn try_open_http_endpoint(
    net_port_config: &NetworkDeviceConfig,
    port_running_state_handle: &Arc<Mutex<bool>>,
) -> Option<HttpEndpoint> {
    let mut http_endpoint = None;

    while *port_running_state_handle.lock().unwrap() && http_endpoint.is_none() {
        // Wait 1 seconds before trying to open the connection again
        thread::sleep(Duration::from_secs(1));

        // Try to open the HTTP connection
        http_endpoint = open(net_port_config);
    }

    http_endpoint
}

/// Prepares the render data for the remote HTTP endpoint
fn prepare_static_text_data_on_display(
    net_port_config: &NetworkDeviceConfig,
    http_endpoint: &HttpEndpoint,
) {
    let text_data = text::get_preparation_data(&net_port_config.display_config);
    let data_to_send = text::serialize(text_data);
    send_http_data(net_port_config, http_endpoint, data_to_send);
}

/// Prepares the render data for the remote HTTP endpoint
fn prepare_static_image_data_on_display(
    net_port_config: &NetworkDeviceConfig,
    http_endpoint: &HttpEndpoint,
) {
    let static_image_data = static_image::get_preparation_data(&net_port_config.display_config);
    let data_to_send = static_image::serialize(static_image_data);
    send_http_data(net_port_config, http_endpoint, data_to_send);
}

/// Prepares the conditional image data and sends it to the remote HTTP endpoint
fn prepare_conditional_image_data_on_display(
    net_port_config: &NetworkDeviceConfig,
    http_endpoint: &HttpEndpoint,
) {
    let conditional_image_data =
        conditional_image::get_preparation_data(&net_port_config.display_config);
    let data_to_send = conditional_image::serialize_preparation_data(conditional_image_data);
    send_http_data(net_port_config, http_endpoint, data_to_send);
}

/// Sends the data to the remote HTTP endpoint
fn send_http_data(
    net_port_config: &NetworkDeviceConfig,
    http_endpoint: &HttpEndpoint,
    data_to_send: Vec<u8>,
) {
    // Log data to send
    let data_len = utils::pretty_bytes(data_to_send.len() as f64);
    info!(
        "Sending data {} {} to '{}'...",
        data_len.0, data_len.1, net_port_config.name
    );

    // Send the actual data via HTTP POST request
    let response = http_endpoint
        .agent
        .post(&format!("{}/data", http_endpoint.address))
        .set("Content-Type", "application/octet-stream")
        .send_bytes(&data_to_send);

    // Handle response status
    match response {
        Ok(resp) => {
            if resp.status() == 200 {
                info!(" Successfully");
            } else {
                warn!(" Failed with status {}", resp.status());
                reconnect_http_endpoint(net_port_config, http_endpoint);
            }
        }
        Err(err) => {
            warn!(" Request failed: {:?} --> Reconnecting", err);
            reconnect_http_endpoint(net_port_config, http_endpoint);
        }
    }
}

/// Attempt to reconnect to the HTTP endpoint
fn reconnect_http_endpoint(net_port_config: &NetworkDeviceConfig, _http_endpoint: &HttpEndpoint) {
    // For now we just log the reconnection attempt
    // Actual reconnection will happen on the next data send attempt
    // due to the stateless nature of HTTP
    info!(
        "Will attempt to reconnect to {} on next data send",
        net_port_config.name
    );
}

/// Serializes the sensor values and display config to a transport message.
/// The transport message is then serialized to a byte vector.
/// The byte vector is then sent to the remote HTTP endpoint.
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
/// and send them to the network endpoint
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

    // Test HTTP connection to the specified address
    check_ip(&ip.unwrap())
}

/// Tests HTTP connection to the specified ip address
pub fn check_ip(ip: &str) -> bool {
    let address = format!("http://{ip}:{NETWORK_PORT}");
    info!("Testing IP '{ip}' on HTTP port '{NETWORK_PORT}'");

    let agent = AgentBuilder::new()
        .timeout_connect(Duration::from_secs(2))
        .build();

    // Try to connect with timeout already configured in the agent
    match agent.get(&format!("{}/ping", address)).call() {
        Ok(_) => true,
        Err(err) => {
            debug!("Connection test failed: {:?}", err);
            false
        }
    }
}
