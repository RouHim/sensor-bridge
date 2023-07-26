use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use log::{debug, error, info, warn};
use message_io::network::{Endpoint, SendStatus, Transport};
use message_io::node::NodeHandler;
use rmp_serde::Serializer;
use sensor_core::{SensorValue, TransferData};
use serde::Serialize;

use crate::config::NetPortConfig;
use crate::sensor;

const PUSH_RATE: Duration = Duration::from_millis(1000);
const NETWORK_PORT: u64 = 10489;

/// Opens a tcp socket to the specified address
pub fn open(net_port_config: &NetPortConfig) -> (NodeHandler<()>, Endpoint) {
    let (handler, _listener) = message_io::node::split::<()>();
    let tcp_endpoint = connect_to_tcp_socket(net_port_config, &handler);
    (handler, tcp_endpoint)
}

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
    let handle = std::thread::spawn(move || {
        // Open the named network port
        let mut net_port = open(&net_port_config);
        while *port_running_state_handle.lock().unwrap() {
            // Read sensor values
            // Measure duration
            let start_time = Instant::now();
            let sensor_values = sensor::read_all_sensor_values(&static_sensor_values);

            let serial_transfer_data = TransferData {
                lcd_config: net_port_config.lcd_config.clone(),
                sensor_values,
            };

            // Serialize data to MessagePack-Format
            let mut data_to_write = Vec::new();
            serial_transfer_data
                .serialize(&mut Serializer::new(&mut data_to_write))
                .unwrap();

            // Write data to tcp socket
            info!(
                "Sending data {} Byte to '{}'...",
                data_to_write.len(),
                net_port_config.name
            );
            let send_status: SendStatus = net_port.0.network().send(net_port.1, &data_to_write);

            // Handle send status
            match send_status {
                SendStatus::MaxPacketSizeExceeded => {
                    error!(" MaxPacketSizeExceeded")
                }
                SendStatus::Sent => {
                    info!(" Successfully")
                }
                SendStatus::ResourceNotFound => {
                    warn!(" Not found --> Reconnecting");
                    net_port = open(&net_port_config);
                }
                SendStatus::ResourceNotAvailable => {
                    warn!(" Not available --> Reconnecting");
                    net_port = open(&net_port_config);
                }
            }

            // Wait for the next iteration
            wait(start_time);
        }

        // Wait for thread to be joined
        thread::park();
    });

    Arc::new(handle)
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
