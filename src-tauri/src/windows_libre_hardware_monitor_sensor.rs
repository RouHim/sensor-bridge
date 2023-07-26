use sensor_core::SensorValue;
#[cfg(target_os = "windows")]
use std::collections::HashMap;
#[cfg(target_os = "windows")]
use wmi::*;

pub fn get_sensor_values() -> Vec<SensorValue> {
    get_all_available_sensors()
}

#[cfg(target_os = "windows")]
fn get_all_available_sensors() -> Vec<SensorValue> {
    let com_library = COMLibrary::new().unwrap();
    let wmi_con =
        WMIConnection::with_namespace_path("ROOT\\LibreHardwareMonitor", com_library).unwrap();

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
    } else if sensor_type.eq("Data") || sensor_type.eq("SmallData") {
        crate::utils::pretty_bytes(*value as usize)
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
fn match_sensor_type(sensor_type: &str) -> (String, String) {
    let (sensor_type, unit) = match sensor_type {
        "Temperature" => ("number", "°C"),
        "Throughput" => ("number", "B/s"),
        "Load" => ("number", "%"),
        "Data" => ("number", "B"),
        "Power" => ("number", "W"),
        "SmallData" => ("number", "B"),
        "Clock" => ("number", "MHz"),
        "Voltage" => ("number", "V"),
        "Energy" => ("number", "mWh"),
        "Control" => ("number", "RPM"),
        "Level" => ("number", "%"),
        "Factor" => ("number", ""),
        "Current" => ("number", "A"),
        _ => ("text", ""),
    };

    (sensor_type.to_string(), unit.to_string())
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
