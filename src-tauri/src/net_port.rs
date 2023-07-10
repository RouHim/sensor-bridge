use crate::config::NetPortConfig;
use message_io::network::{Endpoint, SendStatus, Transport};
use message_io::node::NodeHandler;
use rmp_serde::Serializer;
use sensor_core::TransferData;
use serde::Serialize;

use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use crate::sensor;

const PUSH_RATE: u64 = 1000;

/// Opens a serial port and returns a handle to it.
pub fn open(net_port_config: &NetPortConfig) -> (NodeHandler<()>, Endpoint) {
    let (handler, _listener) = message_io::node::split::<()>();
    let tcp_endpoint = connect_to_tcp_socket(net_port_config, &handler);
    (handler, tcp_endpoint)
}

fn connect_to_tcp_socket(net_port_config: &NetPortConfig, handler: &NodeHandler<()>) -> Endpoint {
    let address = format!("{}:10489", net_port_config.address);
    println!("Connecting to device {}({})", net_port_config.name, address);

    handler
        .network()
        .connect(Transport::FramedTcp, address)
        .unwrap()
        .0
}

/// Starts a new thread that writes to the serial port.
/// Returns a handle to the thread.
/// The thread will be stopped when the port_running_state_handle is set to false.
/// The thread will be joined when the handle is dropped.
pub fn start_sync(
    net_port_config: NetPortConfig,
    port_running_state_handle: Arc<Mutex<bool>>,
) -> Arc<thread::JoinHandle<()>> {
    // Start new thread that writes to the serial port, as configured in to config
    let handle = std::thread::spawn(move || {
        let net_device_name = &net_port_config.name;

        // Open the named serial port with specified baud rate
        let mut net_port = open(&net_port_config);

        while *port_running_state_handle.lock().unwrap() {
            // Read sensor values
            let sensors = sensor::read_all_sensor_values();

            let serial_transfer_data = TransferData {
                lcd_config: net_port_config.lcd_config.clone(),
                sensor_values: sensors,
            };

            // Serialize data to MessagePack-Format
            let mut data_to_write = Vec::new();
            serial_transfer_data
                .serialize(&mut Serializer::new(&mut data_to_write))
                .unwrap();

            // Print data buf size to console
            println!(
                "Sending {} bytes to {}",
                data_to_write.len(),
                net_device_name
            );
            let send_status: SendStatus = net_port.0.network().send(net_port.1, &data_to_write);

            match send_status {
                SendStatus::MaxPacketSizeExceeded => {
                    println!(" MaxPacketSizeExceeded")
                }
                SendStatus::Sent => {
                    println!(" Successfully")
                }
                SendStatus::ResourceNotFound => {
                    println!(" Not found --> Reconnecting");
                    net_port = open(&net_port_config);
                }
                SendStatus::ResourceNotAvailable => {
                    println!(" Not available --> Reconnecting");
                    net_port = open(&net_port_config);
                }
            }

            // Wait for next push
            thread::sleep(Duration::from_millis(PUSH_RATE));
        }

        // Wait for thread to be joined
        thread::park();
    });

    Arc::new(handle)
}
