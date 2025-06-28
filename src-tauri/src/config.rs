use std::collections::HashMap;
use std::fs;
use std::fs::File;

use sensor_core::DisplayConfig;
use serde::Deserialize;
use serde::Serialize;
use uuid::Uuid;

/// The app config
#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct AppConfig {
    pub network_devices: HashMap<String, NetworkDeviceConfig>,
}

/// Config for a single network device
#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct NetworkDeviceConfig {
    pub id: String,
    pub name: String,
    pub active: bool,
    pub web_server_port: u16,
    pub display_config: DisplayConfig,
}

impl NetworkDeviceConfig {
    fn default() -> NetworkDeviceConfig {
        NetworkDeviceConfig {
            id: Uuid::new_v4().to_string(),
            name: "A new device".to_string(),
            active: false,
            web_server_port: 8080,
            display_config: Default::default(),
        }
    }
}

pub fn create_network_device_config() -> NetworkDeviceConfig {
    let new_config = NetworkDeviceConfig::default();
    write(&new_config);
    new_config
}

/// Loads the config file from disk.
/// If the file does not exist, it will be created.
/// Returns the config for the specified network device.
/// If no config for the specified network device exists, None is returned.
pub fn read(network_device_id: &str) -> Option<NetworkDeviceConfig> {
    let config: AppConfig = read_from_app_config();
    config.network_devices.get(network_device_id).cloned()
}

/// Writes the specified config to disk.
/// If the config file does not exist, it will be created.
/// If the config file already exists, the specified config will be added to it.
pub fn write(net_port_config: &NetworkDeviceConfig) {
    let mut config: AppConfig = read_from_app_config();
    config
        .network_devices
        .insert(net_port_config.id.clone(), net_port_config.clone());
    write_to_app_config(&config);
}

/// Writes the specified config to disk.
/// If the config file does not exist, it will be created.
fn write_to_app_config(config: &AppConfig) {
    let config_path = get_config_path();
    let config_file = File::create(config_path).expect("Failed to create config file");
    serde_json::to_writer_pretty(config_file, &config).expect("Failed to write config file");
}

/// Loads the config file from disk.
/// If the file does not exist, it will be created.
pub fn read_from_app_config() -> AppConfig {
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

/// Removes the specified network device from the config file.
pub fn remove(network_device_id: &str) {
    let mut config: AppConfig = read_from_app_config();
    config.network_devices.remove(network_device_id);
    write_to_app_config(&config);
}
