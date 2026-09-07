use std::collections::HashMap;
use std::fs;
use std::fs::File;

use crate::http_server::DisplayClient;
use atomic_write_file::AtomicWriteFile;
use serde::{Deserialize, Serialize};

/// Default HTTP port
fn default_http_port() -> u16 {
    55555
}

/// The app config
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppConfig {
    pub display_clients: HashMap<String, DisplayClient>,
    #[serde(default = "default_http_port")]
    pub http_port: u16,
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            display_clients: HashMap::new(),
            http_port: default_http_port(),
        }
    }
}

/// Writes the specified config to disk.
/// If the config file does not exist, it will be created.
/// Uses atomic writing to prevent corruption during writes.
pub fn write(config: &AppConfig) {
    let config_path = get_config_path();

    let mut file = AtomicWriteFile::options()
        .open(&config_path)
        .expect("Failed to open atomic config file");

    serde_json::to_writer_pretty(&mut file, config).expect("Failed to write config data");

    file.commit().expect("Failed to commit config file");
}

/// Loads the config file from disk.
/// If the file does not exist, it will be created.
pub fn read() -> AppConfig {
    let config_path = get_config_path();

    // Check if config file exists, otherwise create it
    if !std::path::Path::new(&config_path).exists() {
        let config = AppConfig::default();
        let config_file = File::create(&config_path).expect("Failed to create config file");
        serde_json::to_writer_pretty(config_file, &config).expect("Failed to write config file");
    }

    let config_file = File::open(&config_path).expect("Failed to open config file");
    let config = serde_json::from_reader(config_file);

    // If the config deserialization failed, return the default config and save it to disk
    if config.is_err() {
        let config = AppConfig::default();
        let config_file = File::create(&config_path).expect("Failed to create config file");
        serde_json::to_writer_pretty(config_file, &config).expect("Failed to write config file");
        return config;
    }

    config.unwrap()
}

/// Returns the path to the config file.
/// The config file is located in the systems config directory.
/// The file name is config.json.
fn get_config_path() -> String {
    let app_config_path = sensor_core::get_config_dir();

    if !app_config_path.exists() {
        let _ = fs::create_dir_all(&app_config_path);
    }

    app_config_path
        .join("config.json")
        .to_str()
        .unwrap()
        .to_string()
}
