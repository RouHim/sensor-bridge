#[cfg(target_os = "linux")]
use lm_sensors::prelude::*;
use sensor_core::SensorValue;


pub fn get_sensor_values() -> Vec<SensorValue> {
    // if not linux, return empty vector
    if !cfg!(target_os = "linux") {
        return vec![];
    }

    get_all_available_sensors()
}

fn get_all_available_sensors() -> Vec<SensorValue> {
    let mut sensor_values: Vec<SensorValue> = vec![];

    // Get all available sensors
// Initialize LM sensors library.
    let sensors = lm_sensors::Initializer::default().initialize().unwrap();

// Print all chips.
    for chip in sensors.chip_iter(None) {
        let chip_name = chip.prefix().unwrap().unwrap();
        for feature in chip.feature_iter() {
            let name = feature.name().transpose().unwrap().unwrap();
            // Get first sub feature
            let first_sub_feature = feature.sub_feature_iter().next();
            if let Some(sub_feature) = first_sub_feature {
                let feature_value = sub_feature.value().unwrap();

                let sensor_name = format!("{}-{}", chip_name, name);
                let sensor_value = feature_value.raw_value();
                let mut sensor_unit = feature_value.unit().to_string();
                if sensor_unit == "C" {
                    sensor_unit = "°C".to_string();
                }

                let sensor_label = format!("LM: {}", &sensor_name);

                sensor_values.push(SensorValue {
                    id: sensor_name,
                    value: sensor_value.to_string(),
                    unit: sensor_unit,
                    label: sensor_label,
                    sensor_type: "number".to_string(),
                });
            }
        }

    }

    sensor_values
}