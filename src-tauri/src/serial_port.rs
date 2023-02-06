use std::fmt::format;
use std::io::Write;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serialport::*;

use crate::aida64;
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
        let mut com_port = open(&com_port_config.com_port, com_port_config.baud_rate);
        let vec = com_port_config.output_config.values().collect::<Vec<_>>();
        let output_config = vec.get(0).unwrap();

        while *port_running_state_handle.lock().unwrap() {
            let sensors = aida64::read_sensors();

            // Replace all sensor ids from sensor values with the curly brackets sensor ids in the output config
            let mut data = output_config.data_config.clone();
            for sensor in sensors.iter() {
                data = data.replace(
                    format!("[{}]", &sensor.id).as_str(),
                    sensor.value.to_string().as_str(),
                );
            }

            let data = format!("{};", data);
            println!("Writing data: {} -> {}", com_port_config.com_port, data);
            com_port.write_all(data.as_bytes()).unwrap();
            thread::sleep(Duration::from_millis(com_port_config.push_rate as u64));
        }

        println!("Parking port: {}", com_port_config.com_port);
        thread::park();

        println!("Closing port: {}", com_port_config.com_port);
    });

    Arc::new(handle)
}