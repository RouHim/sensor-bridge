use std::collections::HashMap;
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
pub fn open(net_port_config: &NetPortConfig) -> (NodeHandler<()>, Endpoint) {
    let (handler, _listener) = message_io::node::split::<()>();
    let tcp_endpoint = connect_to_tcp_socket(net_port_config, &handler);
    (handler, tcp_endpoint)
}

/// Establishes a tcp connection to the specified address
fn connect_to_tcp_socket(net_port_config: &NetPortConfig, handler: &NodeHandler<()>) -> Endpoint {
    let address = format!("{}:{NETWORK_PORT}", net_port_config.address);

    info!("Connecting to device {}({})", net_port_config.name, address);

    handler
        .network()
        .connect(Transport::FramedTcp, address)
        .unwrap()
        .0
}

/// Starts a new thread that writes to the remote tcp socket.
/// Returns a handle to the thread.
/// The thread will be stopped when the port_running_state_handle is set to false.
/// The thread will be joined when the handle is dropped.
pub fn start_sync(
    static_sensor_values: &Arc<Vec<SensorValue>>,
    net_port_config: NetPortConfig,
    port_running_state_handle: Arc<Mutex<bool>>,
) -> Arc<thread::JoinHandle<()>> {
    let static_sensor_values = static_sensor_values.clone();

    // Start new thread that writes to the remote tcp socket
    let handle = thread::spawn(move || {
        // Open the named network port
        let mut net_port = open(&net_port_config);

        // Prepare asset data
        let asset_data = prepare_assets(&net_port_config.lcd_config);
        let data_to_send = serialize_asset_data(asset_data);
        send_tcp_data(&net_port_config, &mut net_port, data_to_send);

        // Wait 10 seconds for the assets to be loaded
        info!("Waiting for assets to be loaded...");
        thread::sleep(Duration::from_secs(10));

        // Iterate until the port_running_state_handle is set to false
        while *port_running_state_handle.lock().unwrap() {
            // Read sensor values
            // Measure duration
            let start_time = Instant::now();
            let sensor_values = sensor::read_all_sensor_values(&static_sensor_values);
            let lcd_config = net_port_config.lcd_config.clone();

            let data_to_send = serialize_render_data(sensor_values, lcd_config);

            send_tcp_data(&net_port_config, &mut net_port, data_to_send);

            // Wait for the next iteration
            wait(start_time);
        }

        // Wait for thread to be joined
        thread::park();
    });

    Arc::new(handle)
}

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
    // save as png
    let image_data = utils::rgba_to_png_raw(image.to_rgba8());

    // Build response entry
    (element_id.to_string(), image_data)
}

fn send_tcp_data(
    net_port_config: &NetPortConfig,
    net_port: &mut (NodeHandler<()>, Endpoint),
    data_to_send: Vec<u8>,
) {
    // Write data to tcp socket
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
            *net_port = open(net_port_config);
        }
        SendStatus::ResourceNotAvailable => {
            warn!(" Not available --> Reconnecting");
            *net_port = open(net_port_config);
        }
    }
}

/// Serializes the sensor values and lcd config to a transport message.
/// The transport message is then serialized to a byte vector.
/// The byte vector is then sent to the remote tcp socket.
fn serialize_render_data(sensor_values: Vec<SensorValue>, lcd_config: LcdConfig) -> Vec<u8> {
    // Serialize data to render
    let mut data_to_render = Vec::new();
    RenderData {
        lcd_config,
        sensor_values,
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
            Duration::from_millis(0)
        });
    thread::sleep(time_to_wait);
}
