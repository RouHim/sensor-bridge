#![allow(non_camel_case_types)]
#![allow(non_snake_case)]

use std::fmt;

use serde::{Deserialize, Serialize};

mod aida_wmi;
mod serial_port;
mod i2c_display;

#[derive(Serialize, Deserialize)]
pub struct SensorValue {
    id: String,
    value: String,
    label: String,
}

impl fmt::Display for SensorValue {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "id: {}, value: {}, label: {}", self.id, self.value, self.label)
    }
}

fn main() {
    let _values = aida_wmi::collect_sensor_values();
    let ports = serial_port::list_ports();
    println!("Available ports:");
    for port in ports {
        println!("Port: {}", port.port_name);
    }
}

