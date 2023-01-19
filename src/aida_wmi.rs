use std::collections::HashMap;

use wmi::{COMLibrary, Variant, WMIConnection};

use crate::SensorValue;

pub fn open_namespace() -> WMIConnection {
    let com_con = COMLibrary::new().unwrap();
    
    WMIConnection::with_namespace_path("Root\\WMI", com_con).unwrap()
}

pub fn collect_sensor_values(connection: &WMIConnection) -> Vec<SensorValue> {
    let raw_sensor_values: Vec<HashMap<String, Variant>> = connection.raw_query("SELECT * FROM AIDA64_SensorValues").unwrap();
    raw_sensor_values.iter().map(to_sensor_entry).collect()
}

fn to_sensor_entry(entry: &HashMap<String, Variant>) -> SensorValue {
    let mut sensor_id = "".to_string();
    let mut sensor_value = "".to_string();
    let mut senor_label = "".to_string();
    let mut senor_type = "".to_string();

    if let Some(Variant::String(id)) = entry.get("ID") {
        sensor_id = id.to_string();
    }
    if let Some(Variant::String(value)) = entry.get("Value") {
        sensor_value = value.to_string();
    }
    if let Some(Variant::String(label)) = entry.get("Label") {
        senor_label = label.to_string();
    };
    if let Some(Variant::String(stype)) = entry.get("Type") {
        senor_type = stype.to_string();
    };

    SensorValue {
        id: sensor_id,
        value: sensor_value,
        label: senor_label,
        stype: senor_type,
    }
}
