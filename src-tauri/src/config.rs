use sensor_core::LcdConfig;
use std::collections::HashMap;
use std::fs::File;

use serde::Deserialize;
use serde::Serialize;

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct AppConfig {
    pub net_port_config: HashMap<String, NetPortConfig>,
}
#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct NetPortConfig {
    pub name: String,
    pub host: String,
    pub active: bool,
    pub lcd_config: LcdConfig,
}

impl NetPortConfig {
    fn default(name: &str) -> NetPortConfig {
        NetPortConfig {
            name: name.to_string(),
            host: "".to_string(),
            active: false,
            lcd_config: Default::default(),
        }
    }
}

/// Loads the config file from disk.
/// If the file does not exist, it will be created.
/// Returns the config for the specified com port.
/// If no config for the specified com port exists, None is returned.
pub fn load_net_config(name: &str) -> NetPortConfig {
    let config: AppConfig = load_config();
    let maybe_config = config.net_port_config.get(name);

    if maybe_config.is_none() {
        // Create port config
        let port_config = NetPortConfig::default(name);
        write_net_port_config(&port_config);
        return port_config;
    }

    maybe_config.unwrap().clone()
}

/// Writes the specified config to disk.
/// If the config file does not exist, it will be created.
/// If the config file already exists, the specified config will be added to it.
pub fn write_net_port_config(net_port_config: &NetPortConfig) {
    let mut config: AppConfig = load_config();
    config
        .net_port_config
        .insert(net_port_config.name.clone(), net_port_config.clone());
    let config_path = get_config_path();
    let config_file = File::create(config_path).expect("Failed to create config file");
    serde_json::to_writer_pretty(config_file, &config).expect("Failed to write config file");
}

/// Loads the config file from disk.
/// If the file does not exist, it will be created.
fn load_config() -> AppConfig {
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
/// The config file is located in the same directory as the executable.
/// The file name is config.json.
fn get_config_path() -> String {
    let mut config_path = std::env::current_exe().expect("Failed to get current exe path");
    config_path.pop();
    config_path.push("config.json");
    config_path.to_str().unwrap().to_string()
}
