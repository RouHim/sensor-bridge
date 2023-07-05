use rmp_serde::{Deserializer, Serializer};
use sensor_core::SerialTransferData;
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serialport::*;

use crate::config::ComPortConfig;
use crate::sensor;

const PUSH_RATE: u64 = 1000;

/// Opens a serial port and returns a handle to it.
pub fn open(port_name: &str) -> Box<dyn SerialPort> {
    // TODO erstelle zwei prototypen die via websocket miteinander kommunizieren
}

/// List all available serial ports.
pub fn list_ports() -> Vec<String> {
    // TODO
}

/// Starts a new thread that writes to the serial port.
/// Returns a handle to the thread.
/// The thread will be stopped when the port_running_state_handle is set to false.
/// The thread will be joined when the handle is dropped.
pub fn start_sync(
    com_port_config: ComPortConfig,
    port_running_state_handle: Arc<Mutex<bool>>,
) -> Arc<thread::JoinHandle<()>> {
    // Start new thread that writes to the serial port, as configured in to config
    let handle = std::thread::spawn(move || {
        let com_port_name = com_port_config.com_port;

        // Open the named serial port with specified baud rate
        let mut com_port = open(&com_port_name);

        while *port_running_state_handle.lock().unwrap() {
            // Read sensor values
            let sensors = sensor::read_all_sensor_values();

            let serial_transfer_data = SerialTransferData {
                lcd_config: com_port_config.lcd_config.clone(),
                sensor_values: sensors,
            };

            // Serialize data to MessagePack-Format
            let mut data_to_write = Vec::new();
            serial_transfer_data
                .serialize(&mut Serializer::new(&mut data_to_write))
                .unwrap();

            // Print data buf size to console
            println!("Sending {} bytes to {}", data_to_write.len(), com_port_name);
            com_port.write_all(&data_to_write).unwrap();

            // Wait for next push
            thread::sleep(Duration::from_millis(PUSH_RATE));
        }

        // Wait for thread to be joined
        thread::park();
    });

    Arc::new(handle)
}
