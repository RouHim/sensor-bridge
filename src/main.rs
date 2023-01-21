#![allow(non_camel_case_types)]
#![allow(non_snake_case)]

use std::fmt;
use std::io::Write;

use serde::{Deserialize, Serialize};

mod aida_wmi;
mod serial_port;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Aida64Sensor {
    id: String,
    value: String,
    label: String,
    stype: String,
}

impl fmt::Display for Aida64Sensor {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "id: {}, value: {}, label: {} type: {}", self.id, self.value, self.label, self.stype)
    }
}

fn main() {
    let wmi_con = aida_wmi::open_namespace();
    let sensors = aida_wmi::collect_sensors(&wmi_con);

    println!("Available sensors:");
    for sensor in &sensors {
        println!("  {}", sensor);
    }

    let ports = serial_port::list_ports();
    println!("Available ports:");
    for port in &ports {
        println!("  {}", port.port_name);
    }
    let mut port_handle = serial_port::open("COM3", 115200);

    loop {

        // Random number between 0 and 100
        let rnd = rand::random::<u32>() % 100;

        // Write to serial port
        let _ = port_handle
            .write(
                [format!("{}", rnd).as_bytes(), &[0xF7], "C;".as_bytes()]
                    .concat()
                    .as_slice(),
            )
            .unwrap();

        // for port in &ports {
        //     let mut handle = serial_port::open(&port.port_name, 115200);
        //     for sensor in aida_wmi::collect_sensors(&wmi_con) {
        //         if sensor.id == "TCPUPKG" {
        //             let _ = handle.write(sensor.value.as_bytes()).expect("Failed to write to port");
        //         };
        //     }
        // };

        // Sleep for 1 second
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
}

