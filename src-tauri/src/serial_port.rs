use std::io::Write;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serialport::*;

use crate::config::ComPortConfig;
use crate::sensor;

/// Opens a serial port and returns a handle to it.
pub fn open(port_name: &str, baud_rate: u32) -> Box<dyn SerialPort> {
    serialport::new(port_name, baud_rate)
        .timeout(Duration::from_millis(100))
        .open()
        .expect("Failed to open port")
}

/// List all available serial ports.
pub fn list_ports() -> Vec<SerialPortInfo> {
    available_ports().expect("No ports found!")
}

/// Starts a new thread that writes to the serial port.
/// Returns a handle to the thread.
/// The thread will be stopped when the port_running_state_handle is set to false.
/// The thread will be joined when the handle is dropped.
/// The data command sends a single data item to the serial port containing all data values for all configured outputs.
/// - <checksum>i<address_id><font_size><data>,<address_id><font_size><data>,...;
/// - Example: 30i0x3C290°C,0x5C245%,0x8C11000 rpm;
/// Each data command must end with a semicolon (;).
pub fn start_sync(
    com_port_config: ComPortConfig,
    port_running_state_handle: Arc<Mutex<bool>>,
) -> Arc<thread::JoinHandle<()>> {
    // Start new thread that writes to the serial port, as configured in to config
    let handle = std::thread::spawn(move || {
        let com_port_name = com_port_config.com_port;
        let baud_rate = com_port_config.baud_rate;
        let push_rate = com_port_config.push_rate as u64;

        // Open the named serial port with specified baud rate
        let mut com_port = open(&com_port_name, baud_rate);
        let output_configs = com_port_config.output_config;

        while *port_running_state_handle.lock().unwrap() {
            // Read sensor values
            let sensors = sensor::read_all_sensor_values();

            let data_template = output_configs
                .values()
                .map(|output_config| {
                    format!(
                        "{}{}{}",
                        output_config.address, output_config.font_size, output_config.data_config
                    )
                })
                .collect::<Vec<String>>()
                .join(",");

            // Replace all sensor ids with their values
            let mut data_template = data_template.clone();
            for sensor in sensors.iter() {
                data_template = data_template.replace(
                    format!("[{}]", &sensor.id).as_str(),
                    sensor.value.to_string().as_str(),
                );
            }

            // Write data to serial port
            let data = prefix_with_simple_checksum(format!("i{};", data_template));
            println!("Sending data: {}", data);
            com_port.write_all(data.as_bytes()).unwrap();

            // Wait for next push
            thread::sleep(Duration::from_millis(push_rate));
        }

        // Wait for thread to be joined
        thread::park();
    });

    Arc::new(handle)
}

/// Prefixes the data with a simple checksum.
/// The checksum is the length of the data plus two for the checksum but minus the semicolon.
/// So basically plus one.
fn prefix_with_simple_checksum(data: String) -> String {
    format!("{:02}{}", data.len() + 1, data)
}
