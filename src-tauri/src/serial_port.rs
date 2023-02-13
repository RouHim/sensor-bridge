use std::collections::HashMap;

use std::io::Write;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serialport::*;

use crate::aida64;
use crate::config::{ComPortConfig, OutputConfig};

/// Opens a serial port and returns a handle to it.
pub fn open(port_name: &str, baud_rate: u32) -> Box<dyn SerialPort> {
    serialport::new(port_name, baud_rate)
        .timeout(Duration::from_millis(100))
        .open().expect("Failed to open port")
}

/// List all available serial ports.
pub fn list_ports() -> Vec<SerialPortInfo> {
    available_ports().expect("No ports found!")
}

/// Starts a new thread that writes to the serial port.
/// Returns a handle to the thread.
/// The thread will be stopped when the port_running_state_handle is set to false.
/// The thread will be joined when the handle is dropped.
/// Two different data commands are supported:
/// - c<address_id>,<address_id>,...: Replaced with the specified addresses. Used to configure the receiving arduino.
/// - d<sensor_value>,<sensor_value>,...: Replaced with the specified sensor values to send to the previous configured addresses.
/// Each data command must end with a semicolon (;).
/// The data command is sent to the serial port at the specified push rate.
pub fn start_sync(com_port_config: ComPortConfig, port_running_state_handle: Arc<Mutex<bool>>) -> Arc<thread::JoinHandle<()>> {
    // Start new thread that writes to the serial port, as configured in to config
    let handle = std::thread::spawn(move || {
        let com_port_name = com_port_config.com_port;
        let baud_rate = com_port_config.baud_rate;
        let push_rate = com_port_config.push_rate as u64;

        // Open the named serial port with specified baud rate
        let mut com_port = open(&com_port_name, baud_rate);

        let output_configs = com_port_config.output_config;

        configure_output_addresses(&mut com_port, &output_configs);

        let data_template = output_configs
            .values()
            .map(|output_config| output_config.data_config.clone())
            .collect::<Vec<String>>()
            .join(",");

        while *port_running_state_handle.lock().unwrap() {
            // Read sensor values
            let sensors = aida64::read_sensors();

            // Replace all sensor ids with their values
            let mut data_template = data_template.clone();
            for sensor in sensors.iter() {
                data_template = data_template.replace(
                    format!("[{}]", &sensor.id).as_str(),
                    sensor.value.to_string().as_str(),
                );
            }

            // Write data to serial port
            let data = format!("d{};", data_template);
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

/// Tells the receiving arduino which output addresses to use in which order.
/// All following data will be sent to the specified addresses in this order.
/// The arduino will then send the data to the specified addresses.
fn configure_output_addresses(com_port: &mut Box<dyn SerialPort>, output_config: &HashMap<String, OutputConfig>) {
    // Join address string into one comma separated string
    let addresses: Vec<String> = output_config.values()
        .map(|output_config| format!("{}{}", output_config.address, output_config.font_size))
        .collect();
    let addresses = addresses.join(",");

    // Send configure command to arduino
    let configure_command_data = format!("c{};", addresses);
    println!("Sending configure command: {}", configure_command_data);
    com_port.write_all(configure_command_data.as_bytes()).unwrap();
}