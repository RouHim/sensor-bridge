use std::fs;

use crate::utils;
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

fn read_sensor_file(card: &str, file: &str, multi_line_output: bool) -> std::io::Result<String> {
    let path = format!("/sys/class/drm/{}/device/{}", card, file);
    let file_content = fs::read_to_string(path)?;

    // If we got a multi line output, we need to find the active sensor value
    // This is usually the line that ends with a '*'
    if multi_line_output {
        return get_active_line(&file_content);
    }

    Ok(file_content.trim().to_string())
}

fn get_active_line(file_content: &str) -> std::io::Result<String> {
    // Filter out the line that ends with *
    let active_line = file_content
        .split('\n')
        .find(|line| line.trim().ends_with('*'))
        .unwrap_or("");

    // Get only the value after the ":" (Example: "0: 500Mhz *")
    let contents = active_line.split(':').collect::<Vec<&str>>()[1].trim();

    // Extract number from string (Example: " 500Mhz *" -> "500")
    let extracted_number = contents
        .chars()
        .filter(|c| c.is_numeric())
        .collect::<String>();

    Ok(extracted_number.trim().to_string())
}

fn read_sensors(card_name: &str) -> Vec<SensorValue> {
    let card_sensors = vec![
        ("GPU utilization", "gpu_busy_percent", "%", false),
        ("GPU frequency", "pp_dpm_sclk", "Mhz", true),
        ("VRAM frequency", "pp_dpm_mclk", "Mhz", true),
        ("VRAM usage", "mem_info_vram_used", "B", false),
        ("VRAM total", "mem_info_vram_total", "B", false),
    ];

    card_sensors
        .iter()
        .flat_map(|sensor| get_gpu_card_sensor_values(card_name, *sensor).ok())
        .collect()
}

fn get_gpu_card_sensor_values(
    card_name: &str,
    card_sensor: (&str, &str, &str, bool),
) -> std::io::Result<SensorValue> {
    let sensor_name = card_sensor.0;
    let sensor_id = card_sensor.1;
    let mut sensor_unit = card_sensor.2.to_string().clone();
    let multi_line_output = card_sensor.3;

    let mut sensor_value = read_sensor_file(card_name, sensor_id, multi_line_output)?;

    if sensor_unit.eq("B") {
        // Pretty bytes
        let (value, unit) = utils::pretty_bytes(sensor_value.parse::<f64>().unwrap());
        sensor_unit = unit;
        sensor_value = format!("{:.2}", value);
    }

    Ok(SensorValue {
        id: format!("gpu_{}_{}", card_name, sensor_id),
        value: sensor_value,
        unit: sensor_unit,
        label: format!("GPU {} {}", card_name, sensor_name),
        sensor_type: SensorType::Number,
    })
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
