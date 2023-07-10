use crate::cpu_sensor;
use crate::system_sensor;

use rayon::prelude::*;
use sensor_core::SensorValue;

pub trait SensorProvider {
    fn get_name(&self) -> String;
}

pub fn read_all_sensor_values() -> Vec<SensorValue> {
    let mut sensors = vec![];

    // Store reference to CpuSensor {}.get_sensor_values in a vector
    let sensor_requests = vec![
        cpu_sensor::get_sensor_values,
        system_sensor::get_sensor_values,
    ];

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
