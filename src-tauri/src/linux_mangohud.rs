#[cfg(target_os = "linux")]
use std::fs;
#[cfg(target_os = "linux")]
use std::io::BufRead;

use log::{debug, info, warn};
use sensor_core::SensorValue;

pub fn get_sensor_values() -> Vec<SensorValue> {
    get_all_available_sensors()
}

#[cfg(target_os = "windows")]
fn get_all_available_sensors() -> Vec<SensorValue> {
    vec![]
}

#[cfg(target_os = "linux")]
fn get_all_available_sensors() -> Vec<SensorValue> {
    // Check if mangohud is installed
    if fs::metadata("/usr/bin/mangohud").is_err() {
        info!("MangoHUD is not installed");
        return vec![];
    }

    // Get mango hud log dir
    let mangohud_log_dir = match get_mangohud_log_dir() {
        Some(value) => value,
        None => return vec![],
    };

    // Read csv data of the latest log file, if header or data is missing an empty vector is returned
    let csv_data = match get_csv_data(mangohud_log_dir) {
        Some(value) => value,
        None => return vec![],
    };

    // Thus we can be sure here to just unwrap the data
    let mut csv_reader = csv::Reader::from_reader(csv_data.as_bytes());
    let latest_record = csv_reader.records().next().unwrap().unwrap();
    let headers = csv_reader.headers().unwrap();

    // Iterate over headers and for each header get the latest value
    // And of course create a SensorValue of it
    headers
        .iter()
        .enumerate()
        .map(|(header_index, header)| {
            let unit = get_unit_by_header_name(header);
            let value = latest_record.get(header_index).unwrap().to_string();
            let value = value.parse::<f32>().unwrap_or(0.0);

            SensorValue {
                id: format!("mango_{header}"),
                value: format!("{:.2}", value),
                unit,
                label: format!("MangoHUD {}", header.replace('_', " ")),
                sensor_type: "number".to_string(),
            }
        })
        .collect()
}

#[cfg(target_os = "linux")]
/// Parses the csv data from the latest log file and return selected entries (header and latest record)
fn get_csv_data(mangohud_log_dir: String) -> Option<String> {
    // Check if there was a log file that was updated in the last 5 seconds
    let log_file_path = std::path::PathBuf::from(mangohud_log_dir);
    let files = match fs::read_dir(log_file_path) {
        Ok(files) => files,
        _ => return None,
    };

    // Get only the latest log file
    let latest_log_file: Option<std::path::PathBuf> = files
        .into_iter()
        .flatten()
        .filter(|f| f.path().is_file())
        .filter(|f| f.path().extension().unwrap() == "csv")
        .map(|f| f.path())
        .max_by_key(|f| f.metadata().unwrap().modified().unwrap());

    let latest_log_file = match latest_log_file {
        Some(value) => value,
        None => return None,
    };

    let file: fs::File = match fs::File::open(&latest_log_file) {
        Ok(value) => value,
        Err(_) => return None,
    };

    debug!("Found latest MangoHUD log file: {:?}", latest_log_file);

    // Get the 3rd line
    let header_data = std::io::BufReader::new(&file).lines().nth(2);
    // And the last non empty line
    let record_data = rev_buf_reader::RevBufReader::new(file)
        .lines()
        .find(|line| !line.as_ref().unwrap().is_empty());

    // If any of the lines is not present return None
    let header_data = match header_data {
        Some(value) => match value {
            Ok(value) => value,
            Err(_) => return None,
        },
        None => return None,
    };
    let record_data = match record_data {
        Some(value) => match value {
            Ok(value) => value,
            Err(_) => return None,
        },
        None => return None,
    };

    // Combine the header and record data
    Some(format!("{}\n{}", header_data, record_data))
}

#[cfg(target_os = "linux")]
/// Returns the unit for a given header name
fn get_unit_by_header_name(header_name: &str) -> String {
    if header_name.ends_with("_load") || header_name.ends_with("_used") {
        "%".to_string()
    } else if header_name.ends_with("_temp") {
        "°C".to_string()
    } else if header_name.ends_with("_clock") {
        "MHz".to_string()
    } else if header_name.ends_with("_power") {
        "W".to_string()
    } else {
        "".to_string()
    }
}

#[cfg(target_os = "linux")]
/// Returns the log dir of mangohud if it is set in the config file
fn get_mangohud_log_dir() -> Option<String> {
    let mut mangohud_log_dir: Option<String> = None;

    let mut mangohud_conf_path = std::path::PathBuf::from("/usr/bin/MangoHud.conf");
    if mangohud_conf_path.exists() {
        debug!("Found MangoHUD config file: {:?}", mangohud_conf_path);
        mangohud_log_dir = get_mangohud_log_dir_from_file(&mangohud_conf_path);
    }

    mangohud_conf_path = std::path::PathBuf::from("~/.config/MangoHud/MangoHud.conf");
    if mangohud_conf_path.exists() {
        let user_config = get_mangohud_log_dir_from_file(&mangohud_conf_path);
        if user_config.is_some() {
            debug!("Found MangoHUD log dir in user config: {:?}", user_config);
            mangohud_log_dir = user_config;
        }
    }

    debug!("Found MangoHUD log dir: {:?}", mangohud_log_dir);

    mangohud_log_dir
}

#[cfg(target_os = "linux")]
/// Returns the log dir of mangohud if it is set in the config file
fn get_mangohud_log_dir_from_file(config_file: &std::path::PathBuf) -> Option<String> {
    let config_file_contents = fs::read_to_string(config_file).unwrap();
    let config_file_lines = config_file_contents.lines();

    for line in config_file_lines {
        if line.starts_with('#') {
            continue;
        }
        if !line.contains("output_folder") {
            continue;
        }

        let mut line_parts = line.split('=');
        let value = line_parts.nth(1).unwrap().trim();
        return Some(value.to_string());
    }

    warn!("MangoHUD config file does not contain output_folder");

    None
}
