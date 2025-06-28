use sensor_core::{SensorType, SensorValue};

pub fn get_sensor_values() -> Vec<SensorValue> {
    let sensors_requests = [get_system_time];

    sensors_requests.iter().flat_map(|f| f()).collect()
}

fn get_system_time() -> Vec<SensorValue> {
    let time = chrono::Local::now().format("%H:%M:%S").to_string();

    vec![SensorValue {
        id: "system".to_string(),
        value: time,
        unit: "".to_string(),
        label: "System time".to_string(),
        sensor_type: SensorType::Text,
    }]
}
