use std::ffi::OsStr;
use std::fmt;
use std::os::windows::ffi::OsStrExt;
use quick_xml::events::Event;
use quick_xml::Reader;

use winapi::um::memoryapi::{FILE_MAP_READ, MapViewOfFile, OpenFileMappingW};
use winapi::um::winnt::HANDLE;

use serde::{Deserialize, Serialize};

pub fn read_sensors() -> Vec<Aida64Sensor> {
    let xml_string = read_sensor_values();
    parse_xml(&xml_string)
}

fn read_sensor_values() -> String {
    // Convert the shared memory name to a wide string
    let memory_name = OsStr::new("AIDA64_SensorValues").encode_wide().chain(Some(0).into_iter()).collect::<Vec<_>>();

    // Open the shared memory
    let handle = unsafe { OpenFileMappingW(FILE_MAP_READ, 0, memory_name.as_ptr()) };

    if handle == 0 as HANDLE {
        panic!("Failed to open shared memory");
    }

    // Map the shared memory to a view
    let data = unsafe { MapViewOfFile(handle, FILE_MAP_READ, 0, 0, 0) };

    if data.is_null() {
        panic!("Failed to map shared memory to a view");
    }

    // Read the shared memory as a string
    let xml_string = unsafe { std::ffi::CStr::from_ptr(data as *const i8) }.to_str().unwrap();

    let xml_string = format!("<root>{}</root>", xml_string);
    //println!("Shared memory data: {}", xml_string);
    // TODO: write test for this: <root><sys><id>SCPUCLK</id><label>CPU Clock</label><value>3393</value></sys><sys><id>SCPUUTI</id><label>CPU Utilization</label><value>72</value></sys><sys><id>SFREEMEM</id><label>Free Memory</label><value>8986</value></sys><sys><id>SGPU1UTI</id><label>GPU Utilization</label><value>6</value></sys><temp><id>TCPUPKG</id><label>CPU Package</label><value>71</value></temp><temp><id>TGPU1DIO</id><label>GPU Diode</label><value>44</value></temp><fan><id>FCPU</id><label>CPU</label><value>3257</value></fan><pwr><id>PCPUPKG</id><label>CPU Package</label><value>18.94</value></pwr></root>
    xml_string
}

/// parses the sensor values from the xml string
fn parse_xml(xml_string: &str) -> Vec<Aida64Sensor> {
    let mut sensor_values = Vec::new();

    let mut xml_reader = Reader::from_str(xml_string);
    xml_reader.trim_text(true);

    let mut current_value = Vec::new();

    let mut sensor_value = Aida64Sensor {
        id: String::new(),
        label: String::new(),
        value: String::new(),
        sensor_type: String::new(),
    };

    loop {
        match xml_reader.read_event() {
            Ok(Event::Start(ref e)) => {
                match e.name().0 {
                    b"id" => current_value.clear(),
                    b"label" => current_value.clear(),
                    b"value" => current_value.clear(),
                    _ => {}
                }
            }
            Ok(Event::Text(e)) => {
                current_value.extend(e.unescape().unwrap().as_bytes().to_vec());
            }
            Ok(Event::End(ref e)) => {
                match e.name().0 {
                    b"id" => sensor_value.id = String::from_utf8(current_value.clone()).unwrap(),
                    b"label" => sensor_value.label = String::from_utf8(current_value.clone()).unwrap(),
                    b"value" => sensor_value.value = String::from_utf8(current_value.clone()).unwrap(),
                    b"temp" | b"sys" | b"fan" | b"pwr" => {
                        sensor_value.sensor_type = String::from_utf8(e.name().0.to_vec()).unwrap();
                        sensor_values.push(sensor_value.clone());
                    },
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                println!("Error: {}", e);
                break;
            }
            _ => {}
        }
    }

    sensor_values
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct Aida64Sensor {
    pub id: String,
    pub value: String,
    pub label: String,
    pub sensor_type: String,
}

impl fmt::Display for Aida64Sensor {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "id: {}, value: {}, label: {} type: {}", self.id, self.value, self.label, self.sensor_type)
    }
}
