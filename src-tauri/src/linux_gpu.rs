use log::debug;
use std::fs;

use sensor_core::{SensorType, SensorValue};

pub fn get_sensor_values() -> Vec<SensorValue> {
    read_all_sensors()
}

fn get_gpu_cards() -> Vec<String> {
    let paths = if let Ok(paths) = fs::read_dir("/sys/class/drm") {
        paths
    } else {
        return Vec::new();
    };

    let mut cards = Vec::new();
    for path in paths {
        let path_str = if let Ok(path) = path {
            path.file_name().into_string().unwrap()
        } else {
            continue;
        };
        if path_str.starts_with("card") {
            cards.push(path_str);
        }
    }

    cards
}

fn read_sensor_file(card: &str, file: &str) -> std::io::Result<String> {
    let path = format!("/sys/class/drm/{}/device/{}", card, file);
    let contents = fs::read_to_string(path)?;
    Ok(contents.trim().to_string())
}

fn read_sensors(card_name: &str) -> Vec<SensorValue> {
    // TODO: For mhz lines grep lines with * at the end
    // It is the current frequency
    // Cleanup strings to only get the number of the line

    let card_sensors = vec![
        ("GPU utilization", "gpu_busy_percent", "%"),
        ("GPU frequency", "pp_dpm_sclk", "Mhz"),
        ("VRAM frequency", "pp_dpm_mclk", "Mhz"),
        ("VRAM usage", "mem_info_vram_used", "B"),
        ("VRAM total", "mem_info_vram_total", "B"),
    ];
    let mut sensor_values = Vec::new();

    for card_sensor in card_sensors {
        let value = read_sensor_file(card_name, card_sensor.1);

        if value.is_err() {
            debug!(
                "Could not read sensor file {}: {:?}",
                card_sensor.1,
                value.err()
            );
            continue;
        }

        let sensor_value = SensorValue {
            id: format!("gpu_{}_{}", card_name, card_sensor.1),
            value: value.unwrap(),
            unit: card_sensor.2.to_string(),
            label: format!("GPU {} {}", card_name, card_sensor.0),
            sensor_type: SensorType::Number,
        };

        sensor_values.push(sensor_value);
    }

    sensor_values
}

fn read_all_sensors() -> Vec<SensorValue> {
    let cards = get_gpu_cards();
    let mut all_sensors = Vec::new();
    for card in cards {
        let sensors = read_sensors(&card);
        all_sensors.extend(sensors);
    }
    all_sensors
}
