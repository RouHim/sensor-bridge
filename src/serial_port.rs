
use std::io::prelude::*;

use std::time::Duration;

use serialport::*;

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

pub fn send_data_to_serial_port(port_handle: &mut Box<dyn SerialPort>, data: &str) {
    port_handle.write(data.as_bytes()).expect("Failed to write to port");
}