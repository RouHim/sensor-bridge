use crate::cpu_sensor::CpuSensor;
use serde::{Deserialize, Serialize};
use std::fmt;
use crate::cpu_sensor;
use rayon::prelude::*;

pub trait SensorProvider {
    fn get_name(&self) -> String;
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

    // Store reference to CpuSensor {}.get_sensor_values in a vector
    let sensor_requests = vec![cpu_sensor::get_sensor_values];

    // Iterate over the vector and call each function using par_iter
    sensor_requests
        .par_iter()
        .flat_map(|f| f())
        .collect::<Vec<SensorValue>>()
        .iter()
        .for_each(|sensor_value| {
            sensors.push(sensor_value.clone());
        });

    sensors
}
