use std::collections::HashMap;
use std::net::IpAddr;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use log::{debug, error, info, warn};
use message_io::network::{Endpoint, SendStatus, Transport};
use message_io::node::NodeHandler;
use rayon::prelude::*;
use rmp_serde::Serializer;
use sensor_core::{
    AssetData, ElementType, ImageConfig, LcdConfig, RenderData, SensorValue, TransportMessage,
    TransportType,
};
use serde::Serialize;

use crate::config::NetPortConfig;
use crate::{sensor, utils};

const PUSH_RATE: Duration = Duration::from_millis(1000);
const NETWORK_PORT: u64 = 10489;

/// Opens a tcp socket to the specified address
pub fn open(net_port_config: &NetPortConfig) -> Option<(NodeHandler<()>, Endpoint)> {
    let (handler, _listener) = message_io::node::split::<()>();
    let tcp_endpoint = connect_to_tcp_socket(net_port_config, &handler);

    tcp_endpoint.map(|endpoint| (handler, endpoint))
}

/// Establishes a tcp connection to the specified address
fn connect_to_tcp_socket(
    net_port_config: &NetPortConfig,
    handler: &NodeHandler<()>,
) -> Option<Endpoint> {
    let ip = resolve_hostname(net_port_config);

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

/// Resolves the name of the device to an ip address
fn resolve_hostname(net_port_config: &NetPortConfig) -> Option<String> {
    let target = &net_port_config.address;

    // Check if target string is an valid ip address
    if IpAddr::from_str(target).is_ok() {
        return Some(target.to_string());
    }

    // Otherwise we most likely have a hostname, try to resolve the hostname
    // and get the first ipv4 address
    return match dns_lookup::lookup_host(target).ok() {
        Some(ips) => ips
            .iter()
            .filter(|ip| ip.is_ipv4())
            .map(|ip| ip.to_string())
            .next(),
        None => {
            error!("Could not resolve hostname {}", target);
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
    net_port_config: NetPortConfig,
    port_running_state_handle: Arc<Mutex<bool>>,
) -> Arc<thread::JoinHandle<()>> {
    let static_sensor_values = static_sensor_values.clone();
    let sensor_value_history = sensor_value_history.clone();

    // Start new thread that writes to the remote tcp socket
    let handle = thread::spawn(move || {
        // Try to open the named network port
        let mut net_port = match open(&net_port_config) {
            Some((handler, endpoint)) => (handler, endpoint),
            None => {
                // Set the port_running_state_handle to false
                *port_running_state_handle.lock().unwrap() = false;
                return;
            }
        };

        // Prepare asset data
        let asset_data = prepare_assets(&net_port_config.lcd_config);
        let data_to_send = serialize_asset_data(asset_data);
        send_tcp_data(&net_port_config, &mut net_port, data_to_send);

        // Wait 1 seconds for the assets to be loaded
        info!("Waiting 1s for assets to be loaded...");
        thread::sleep(Duration::from_secs(1));

        // Iterate until the port_running_state_handle is set to false
        while *port_running_state_handle.lock().unwrap() {
            // Measure duration
            let start_time = Instant::now();

            // Read sensor values
            sensor::read_all_sensor_values(&sensor_value_history, &static_sensor_values);

            // Serialize the transport struct to bytes using messagepack
            let data_to_send =
                serialize_render_data(&sensor_value_history, net_port_config.lcd_config.clone());

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

/// Serializes the render data to bytes using messagepack
/// and wraps it in a TransportMessage
/// Returns the bytes to send
fn serialize_asset_data(data: AssetData) -> Vec<u8> {
    let mut asset_data = Vec::new();
    data.serialize(&mut Serializer::new(&mut asset_data))
        .unwrap();

    let mut data_to_send = Vec::new();
    TransportMessage {
        transport_type: TransportType::PrepareData,
        data: asset_data,
    }
    .serialize(&mut Serializer::new(&mut data_to_send))
    .unwrap();

    data_to_send
}

/// Pre-renders assets
fn prepare_assets(lcd_config: &LcdConfig) -> AssetData {
    let image_data: HashMap<String, Vec<u8>> = lcd_config
        .elements
        .par_iter()
        .filter(|element| element.element_type == ElementType::StaticImage)
        .map(|element| prepare_image(&element.id, &element.image_config))
        .collect();

    AssetData {
        asset_data: image_data,
    }
}

/// Reads each image into memory, scales it to the desired resolution, and returns it
fn prepare_image(element_id: &str, image_config: &ImageConfig) -> (String, Vec<u8>) {
    let image = image::open(&image_config.image_path).unwrap();
    let image = image.resize_exact(
        image_config.image_width,
        image_config.image_height,
        image::imageops::FilterType::Lanczos3,
    );
    // convert to png
    let image_data = utils::rgba_to_png_bytes(image);

    // Build response entry
    (element_id.to_string(), image_data)
}

/// Sends the data to the remote tcp socket
fn send_tcp_data(
    net_port_config: &NetPortConfig,
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
            // ignore errors
            *net_port = match open(net_port_config) {
                Some((handler, endpoint)) => (handler, endpoint),
                None => {
                    return;
                }
            };
        }
        SendStatus::ResourceNotAvailable => {
            warn!(" Not available --> Reconnecting");
            *net_port = match open(net_port_config) {
                Some((handler, endpoint)) => (handler, endpoint),
                None => {
                    return;
                }
            }
        }
    }
}

/// Serializes the sensor values and lcd config to a transport message.
/// The transport message is then serialized to a byte vector.
/// The byte vector is then sent to the remote tcp socket.
fn serialize_render_data(
    sensor_value_history: &Arc<Mutex<Vec<Vec<SensorValue>>>>,
    lcd_config: LcdConfig,
) -> Vec<u8> {
    // Serialize data to render
    let mut data_to_render = Vec::new();
    RenderData {
        lcd_config,
        sensor_value_history: sensor_value_history.lock().unwrap().clone(),
    }
    .serialize(&mut Serializer::new(&mut data_to_render))
    .unwrap();

    // Serialize transport message
    let mut data_to_send = Vec::new();
    TransportMessage {
        transport_type: TransportType::RenderImage,
        data: data_to_render,
    }
    .serialize(&mut Serializer::new(&mut data_to_send))
    .unwrap();

    data_to_send
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
