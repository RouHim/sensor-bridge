use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serialport::*;

use crate::config::ComPortConfig;

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

pub fn start_sync(com_port_config: ComPortConfig, port_running_state_handle: Arc<Mutex<bool>>) -> Arc<thread::JoinHandle<()>> {
    // Start new thread that writes to the serial port, as configured in to config
    let handle = std::thread::spawn(move || {
        let mut open = open(&com_port_config.com_port, com_port_config.baud_rate);
        while *port_running_state_handle.lock().unwrap() {
            // Write to the serial port
            //open.write_all(b"Hello, world!").unwrap();
            println!("Writing to port: {}", com_port_config.com_port);
            std::thread::sleep(Duration::from_millis(com_port_config.push_rate as u64));
        }

        println!("Parking port: {}", com_port_config.com_port);
        thread::park();

        println!("Closing port: {}", com_port_config.com_port);
    });

    Arc::new(handle)
}