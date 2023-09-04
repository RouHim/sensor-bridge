#[cfg(target_os = "windows")]
use std::collections::HashMap;

#[cfg(target_os = "windows")]
use log::error;
#[cfg(target_os = "windows")]
use sensor_core::SensorType;
use sensor_core::SensorValue;
#[cfg(target_os = "windows")]
use wmi::*;

pub fn get_sensor_values() -> Vec<SensorValue> {
    get_all_available_sensors()
}

#[cfg(target_os = "windows")]
fn get_all_available_sensors() -> Vec<SensorValue> {
    // Check if the WMI namespace exists
    let wmi_con = match WMIConnection::with_namespace_path(
        "ROOT\\LibreHardwareMonitor",
        COMLibrary::new().unwrap(),
    ) {
        Ok(wmi_con) => wmi_con,
        _ => {
            error!("WMI namespace ROOT\\LibreHardwareMonitor not found. Is LibreHardwareMonitor running?");
            return vec![];
        }
    };

    let hardware_list: Vec<HashMap<String, Variant>> =
        match wmi_con.raw_query("SELECT * FROM Hardware") {
            Ok(entries) => entries,
            _ => return vec![],
        };
    let sensor_list: Vec<HashMap<String, Variant>> = match wmi_con.raw_query("SELECT * FROM Sensor")
    {
        Ok(entries) => entries,
        _ => return vec![],
    };

    let hardware_list: HashMap<String, String> =
        hardware_list.iter().filter_map(to_hardware_entry).collect();

    let mut sensor_list: Vec<SensorValue> = sensor_list
        .iter()
        .filter_map(|entry| to_sensor_value(&hardware_list, entry))
        .collect();

    sensor_list.sort_by(|a, b| a.label.cmp(&b.label));

    sensor_list
}

#[cfg(target_os = "linux")]
fn get_all_available_sensors() -> Vec<SensorValue> {
    vec![]
}

#[cfg(target_os = "windows")]
fn to_sensor_value(
    hardware_list: &HashMap<String, String>,
    entry: &HashMap<String, Variant>,
) -> Option<SensorValue> {
    let sensor_type = match entry.get("SensorType") {
        Some(Variant::String(s)) => s.to_string(),
        _ => return None,
    };
    let name = match entry.get("Name") {
        Some(Variant::String(s)) => s.to_string(),
        _ => return None,
    };
    let value = match entry.get("Value") {
        Some(Variant::R4(s)) => s,
        _ => return None,
    };
    let parent = match entry.get("Parent") {
        Some(Variant::String(s)) => s.to_string(),
        _ => return None,
    };
    let identifier = match entry.get("Identifier") {
        Some(Variant::String(s)) => s.to_string(),
        _ => return None,
    };

    let hardware_name = hardware_list.get(&parent).unwrap();
    let (sensor_value_type, unit) = match_sensor_type(&sensor_type);

    // For sensor types: "Throughput", "Data", "SmallData" convert to human readable value and unit
    let (value, unit) = if sensor_type.eq("Throughput") {
        let (value, unit) = crate::utils::pretty_bytes(*value as usize);
        (value, format!("{unit}/s"))
    } else {
        (*value as f64, unit)
    };

    // Improve the label, by appending the sensor type at the end
    let label = if name.contains(&sensor_type) {
        format!("{hardware_name} {name}")
    } else {
        format!("{hardware_name} {name} {sensor_type}")
    };

    Some(SensorValue {
        id: identifier,
        value: format!("{:.2}", value),
        unit,
        label,
        sensor_type: sensor_value_type,
    })
}

#[cfg(target_os = "windows")]
fn match_sensor_type(sensor_type: &str) -> (SensorType, String) {
    let (sensor_type, unit) = match sensor_type {
        "Temperature" => (SensorType::Number, "°C"),
        "Throughput" => (SensorType::Number, "B/s"),
        "Load" => (SensorType::Number, "%"),
        "Data" => (SensorType::Number, "B"),
        "Power" => (SensorType::Number, "W"),
        "SmallData" => (SensorType::Number, "MB"),
        "Clock" => (SensorType::Number, "MHz"),
        "Voltage" => (SensorType::Number, "V"),
        "Energy" => (SensorType::Number, "mWh"),
        "Control" => (SensorType::Number, "RPM"),
        "Level" => (SensorType::Number, "%"),
        "Factor" => (SensorType::Number, ""),
        "Current" => (SensorType::Number, "A"),
        _ => (SensorType::Text, ""),
    };

    (sensor_type, unit.to_string())
}

#[cfg(target_os = "windows")]
fn to_hardware_entry(entry: &HashMap<String, Variant>) -> Option<(String, String)> {
    let name = match entry.get("Name") {
        Some(Variant::String(s)) => s.to_string(),
        _ => return None,
    };
    let identifier = match entry.get("Identifier") {
        Some(Variant::String(s)) => s.to_string(),
        _ => return None,
    };

    Some((identifier, name))
}

#[cfg(target_os = "windows")]
pub(crate) fn check_running() {
    let mut error_message = String::new();

    let wmi_con = match WMIConnection::with_namespace_path(
        "ROOT\\LibreHardwareMonitor",
        COMLibrary::new().unwrap(),
    ) {
        Ok(wmi_con) => wmi_con,
        _ => {
            error_message.push_str("WMI namespace ROOT\\LibreHardwareMonitor not found. Is LibreHardwareMonitor running?\n");
            return;
        }
    };

    let hardware_list: Vec<HashMap<String, Variant>> =
        match wmi_con.raw_query("SELECT * FROM Hardware") {
            Ok(entries) => entries,
            _ => return,
        };

    if hardware_list.is_empty() {
        error_message
            .push_str("No LibreHardwareMonitor sensors found. Is LibreHardwareMonitor running?\n");
    }

    // Use powershell to display the error message as a popup
    if !error_message.is_empty() {
        display_error_message(error_message);
    }
}

#[cfg(target_os = "linux")]
pub(crate) fn check_running() {}

#[cfg(target_os = "windows")]
fn display_error_message(message: String) {
    unsafe {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;
        use winapi::um::winuser::{MessageBoxW, MB_OK};

        let title: *const u16 = OsStr::new("LibreHardwareMonitorSensor")
            .encode_wide()
            .chain(Some(0))
            .collect::<Vec<_>>()
            .as_ptr();

        let wide: Vec<u16> = OsStr::new(&message).encode_wide().chain(Some(0)).collect();
        MessageBoxW(std::ptr::null_mut(), wide.as_ptr(), title, MB_OK);
    }

    panic!("{message}");
}
