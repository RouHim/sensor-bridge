use std::collections::HashMap;
use std::fs::File;

use crate::config::OutputMode::{I2c, Lcd, Spi};
use serde::Deserialize;
use serde::Serialize;

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct AppConfig {
    pub com_port_config: HashMap<String, ComPortConfig>,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct ComPortConfig {
    pub com_port: String,
    pub active: bool,
    pub mode: OutputMode,
    pub lcd_config: LcdConfig,
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct LcdConfig {
    pub resolution_height: u32,
    pub resolution_width: u32,
}

impl LcdConfig {
    fn default() -> LcdConfig {
        LcdConfig {
            resolution_height: 512,
            resolution_width: 512,
        }
    }
}

impl ComPortConfig {
    fn default(com_port: &str) -> ComPortConfig {
        ComPortConfig {
            com_port: com_port.to_string(),
            active: false,
            mode: Lcd,
            lcd_config: LcdConfig::default(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub enum OutputMode {
    #[default]
    Lcd,
    I2c,
    Spi,
}

impl OutputMode {
    pub fn from_str(s: &str) -> Self {
        match s {
            "Lcd" => Lcd,
            "I2c" => I2c,
            "Spi" => Spi,
            _ => Lcd,
        }
    }
}

/// Loads the config file from disk.
/// If the file does not exist, it will be created.
/// Returns the config for the specified com port.
/// If no config for the specified com port exists, None is returned.
pub fn load_port_config(com_port: &str) -> ComPortConfig {
    let config: AppConfig = load_config();
    let maybe_config = config.com_port_config.get(com_port);

    if maybe_config.is_none() {
        // Create port config
        let port_config = ComPortConfig::default(com_port);
        write_port_config(&port_config);
        return port_config;
    }

    maybe_config.unwrap().clone()
}

/// Writes the specified config to disk.
/// If the config file does not exist, it will be created.
/// If the config file already exists, the specified config will be added to it.
pub fn write_port_config(com_port_config: &ComPortConfig) {
    let mut config: AppConfig = load_config();
    config
        .com_port_config
        .insert(com_port_config.com_port.clone(), com_port_config.clone());
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
