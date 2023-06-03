use crate::cpu_sensor::CpuSensor;
use serde::{Deserialize, Serialize};
use std::fmt;

pub trait SensorProvider {
    fn get_name(&self) -> String;
    fn get_sensor_values(&self) -> Vec<SensorValue>;
}

/// Provides a single SensorValue
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct SensorValue {
    pub id: String,
    pub value: String,
    pub unit: String,
    pub label: String,
    pub sensor_type: String,
}

/// Renders a SensorValue to a string
impl fmt::Display for SensorValue {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(
            f,
            "id: {}, value: {}, label: {} type: {}",
            self.id, self.value, self.label, self.sensor_type
        )
    }
}

pub fn read_all_sensor_values() -> Vec<SensorValue> {
    let mut sensors = vec![];

    sensors.extend(CpuSensor {}.get_sensor_values());

    sensors
}
