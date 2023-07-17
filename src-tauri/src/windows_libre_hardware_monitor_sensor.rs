#[cfg(target_os = "linux")]
use lm_sensors::prelude::*;
use sensor_core::SensorValue;

pub fn get_sensor_values() -> Vec<SensorValue> {
    get_all_available_sensors()
}

#[cfg(target_os = "windows")]
fn get_all_available_sensors() -> Vec<SensorValue> {
    // TODO: Implement this
}

#[cfg(target_os = "linux")]
fn get_all_available_sensors() -> Vec<SensorValue> {
    vec![]
}
