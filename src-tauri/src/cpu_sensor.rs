use crate::sensor;
use crate::sensor::SensorValue;
use rayon::prelude::*;
use std::thread;
use std::time::Duration;
use systemstat::platform::PlatformImpl;
use systemstat::{Platform, System};

pub struct CpuSensor {}

impl sensor::SensorProvider for CpuSensor {
    fn get_name(&self) -> String {
        "CPU".to_string()
    }

    fn get_sensor_values(&self) -> Vec<SensorValue> {
        let system_stat = System::new();

        let sensors_requests = vec![get_total_cpu_load, get_individual_cpu_load];

        sensors_requests
            .par_iter()
            .flat_map(|f| f(&system_stat))
            .collect()
    }
}

fn get_total_cpu_load(system_stat: &PlatformImpl) -> Vec<SensorValue> {
    let cpu_load = system_stat.cpu_load_aggregate().unwrap();
    thread::sleep(Duration::from_millis(250));
    let cpu = cpu_load.done().unwrap();
    let total_cpu_load =
        cpu.user * 100.0 + cpu.nice * 100.0 + cpu.system * 100.0 + cpu.interrupt * 100.0;

    vec![SensorValue {
        id: "cpu_load_total".to_string(),
        value: format!("{:.2}%", total_cpu_load),
        label: "Total CPU load".to_string(),
        sensor_type: "percentage".to_string(),
    }]
}

fn get_individual_cpu_load(system_stat: &PlatformImpl) -> Vec<SensorValue> {
    let cpu_load = system_stat.cpu_load().unwrap();
    thread::sleep(Duration::from_millis(250));
    let cpus = cpu_load.done().unwrap();

    cpus.into_iter()
        .enumerate()
        .map(|(i, cpu)| {
            let total_cpu_load =
                cpu.user * 100.0 + cpu.nice * 100.0 + cpu.system * 100.0 + cpu.interrupt * 100.0;
            SensorValue {
                id: format!("cpu_load_{}", i),
                value: format!("{:.2}%", total_cpu_load),
                label: format!("CPU {} load", i),
                sensor_type: "percentage".to_string(),
            }
        })
        .collect()
}
