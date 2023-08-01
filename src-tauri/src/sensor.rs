use std::sync::{Arc, Mutex};
use std::thread;

use log::debug;
use sensor_core::SensorValue;
use super_shell::RootShell;

use crate::linux_dmidecode_sensors::DmiDecodeSensors;
use crate::{linux_lm_sensors, misc_sensor, windows_libre_hardware_monitor_sensor};
use crate::{linux_mangohud, system_stat_sensor};

pub trait SensorProvider {
    fn get_name(&self) -> String;
}

pub fn read_all_sensor_values(static_sensor_values: &Arc<Vec<SensorValue>>) -> Vec<SensorValue> {
    let static_sensor_values = static_sensor_values.iter().cloned().collect();

    thread::spawn(move || {
        // Measurement that it took to read all sensors
        let start = std::time::Instant::now();

        let mut sensor_values: Vec<SensorValue> =
            [static_sensor_values, read_dynamic_sensor_values()].concat();

        // Sort sensors by label
        sensor_values.sort_by(|a, b| a.label.cmp(&b.label));

        debug!(
            "Reading all sensors took {:?}",
            std::time::Instant::now().duration_since(start)
        );

        sensor_values
    })
    .join()
    .unwrap()
}

/// Reads the dynamic sensor values
/// This is done every update interval
fn read_dynamic_sensor_values() -> Vec<SensorValue> {
    // Store reference to CpuSensor {}.get_sensor_values in a vector
    let sensor_requests = vec![
        system_stat_sensor::get_sensor_values,
        misc_sensor::get_sensor_values,
        linux_lm_sensors::get_sensor_values,
        linux_mangohud::get_sensor_values,
        windows_libre_hardware_monitor_sensor::get_sensor_values,
    ];

    let mut sensor_values = vec![];

    // Iterate over the vector and call each function using par_iter
    sensor_requests
        .into_iter()
        .flat_map(|f| f())
        .collect::<Vec<SensorValue>>()
        .iter()
        .for_each(|sensor_value| {
            sensor_values.push(sensor_value.clone());
        });

    sensor_values
}

/// Reads the static sensor values
/// This is done only once at startup
pub fn read_static_sensor_values(
    root_shell_mutex: &Arc<Mutex<Option<RootShell>>>,
) -> Vec<SensorValue> {
    DmiDecodeSensors::new(root_shell_mutex.clone()).get_sensor_values()
}
