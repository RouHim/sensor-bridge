use crate::{linux_lm_sensors, misc_sensor};
use crate::system_stat_sensor;

use rayon::prelude::*;
use sensor_core::SensorValue;

pub trait SensorProvider {
    fn get_name(&self) -> String;
}

pub fn read_all_sensor_values() -> Vec<SensorValue> {
    // Measurement that it tooks to read all sensors
    let start = std::time::Instant::now();

    let mut sensors = vec![];

    // Store reference to CpuSensor {}.get_sensor_values in a vector
    let sensor_requests = vec![
        system_stat_sensor::get_sensor_values,
        misc_sensor::get_sensor_values,
        linux_lm_sensors::get_sensor_values,
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

    println!("Reading all sensors took {:?}", std::time::Instant::now().duration_since(start));

    sensors
}
