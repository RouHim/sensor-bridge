#![allow(non_camel_case_types)]
#![allow(non_snake_case)]

use std::fmt;

use serde::{Deserialize, Serialize};

mod aida_wmi;
mod serial_port;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SensorValue {
    id: String,
    value: String,
    label: String,
    stype: String,
}

impl fmt::Display for SensorValue {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "id: {}, value: {}, label: {} type: {}", self.id, self.value, self.label, self.stype)
    }
}

fn main() {
    let wmi_con = aida_wmi::open_namespace();
    let values = aida_wmi::collect_sensor_values(&wmi_con);

    println!("Available sensors:");
    for value in &values {
        println!("  {}", value);
    }

    let ports = serial_port::list_ports();
    println!("Available ports:");
    for port in &ports {
        println!("  {}", port.port_name);
    }

    loop {
        for port in &ports {
            let mut handle = serial_port::open(&port.port_name, 9600);
            for value in aida_wmi::collect_sensor_values(&wmi_con) {
                let sensor_value = format!("{}: {}", value.label, value.value);
                println!("{} --> {}", sensor_value, port.port_name);
                let _ = handle.write(sensor_value.as_bytes()).expect("Failed to write to port");
            }
        };

        // Sleep for 1 second
        std::thread::sleep(std::time::Duration::from_secs(1));
    }
}

