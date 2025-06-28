#[cfg(target_os = "linux")]
use sensor_core::SensorType;
use sensor_core::SensorValue;

pub fn get_sensor_values() -> Vec<SensorValue> {
    get_all_available_sensors()
}

#[cfg(target_os = "linux")]
fn get_all_available_sensors() -> Vec<SensorValue> {
    let mut sensor_values: Vec<SensorValue> = vec![];

    // Get all available sensors
    // Initialize LM sensors library and wait until it is not used by another process
    let mut sensors = lm_sensors::Initializer::default().initialize().ok();
    while sensors.is_none() {
        sensors = lm_sensors::Initializer::default().initialize().ok();
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
    let sensors = sensors.unwrap();

    // Print all chips.
    for chip in sensors.chip_iter(None) {
        let chip_name = chip.prefix().unwrap().unwrap();
        for feature in chip.feature_iter() {
            let name = feature.name().transpose().unwrap().unwrap();
            // Get first sub feature
            let first_sub_feature = feature.sub_feature_iter().next();
            if let Some(sub_feature) = first_sub_feature {
                let sub_feature_value = sub_feature.value();
                if sub_feature_value.is_err() {
                    continue;
                }

                let feature_value = sub_feature_value.unwrap();

                let sensor_name = format!("{}-{}", chip_name, name);
                let sensor_value = feature_value.raw_value();
                let mut sensor_unit = feature_value.unit().to_string();
                if sensor_unit == "C" {
                    sensor_unit = "°C".to_string();
                }

                sensor_values.push(SensorValue {
                    id: format!("lm_{sensor_name}"),
                    value: sensor_value.to_string(),
                    unit: sensor_unit,
                    label: sensor_name,
                    sensor_type: SensorType::Number,
                });
            }
        }
    }

    sensor_values
}
