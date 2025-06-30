use sensor_core::{SensorType, SensorValue};
use std::fs;

pub fn get_sensor_values() -> Vec<SensorValue> {
    get_all_available_sensors()
}

fn get_all_available_sensors() -> Vec<SensorValue> {
    let cpuinfo = fs::read_to_string("/proc/cpuinfo").unwrap();
    cpuinfo
        .lines()
        .filter(|line| line.contains("cpu MHz"))
        .enumerate()
        .map(|(i, line)| {
            let cpu_frequency: f32 = line.split(':').collect::<Vec<&str>>()[1]
                .trim()
                .parse()
                .unwrap();
            let sensor_name = format!("cpu{}-frequency", i);
            let sensor_label = format!("CPU {} Frequency", i);

            SensorValue {
                id: sensor_name,
                value: format!("{:.0}", cpu_frequency),
                unit: "MHz".to_string(),
                label: sensor_label,
                sensor_type: SensorType::Number,
            }
        })
        .collect()
}
