use std::collections::HashMap;
use std::fs;
use std::fs::File;

use chrono::{DateTime, Utc};
use sensor_core::DisplayConfig;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// The app config
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppConfig {
    pub registered_clients: HashMap<String, RegisteredClient>,
    #[serde(default = "default_http_port")]
    pub http_port: u16,
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            registered_clients: HashMap::new(),
            http_port: default_http_port(),
        }
    }
}

/// A registered client identified by MAC address
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RegisteredClient {
    pub mac_address: String,
    pub name: String,
    pub ip_address: String,
    pub resolution_width: u32,
    pub resolution_height: u32,
    pub active: bool,
    #[serde(with = "chrono::serde::ts_seconds")]
    pub last_seen: DateTime<Utc>,
    pub display_config: DisplayConfig,
}

/// Legacy NetworkDeviceConfig for backward compatibility during migration
#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct NetworkDeviceConfig {
    pub id: String,
    pub name: String,
    pub address: String,
    pub active: bool,
    pub display_config: DisplayConfig,
}

impl RegisteredClient {
    pub fn new(
        mac_address: String,
        ip_address: String,
        resolution_width: u32,
        resolution_height: u32,
    ) -> Self {
        RegisteredClient {
            mac_address: mac_address.clone(),
            name: format!("Display {}", &mac_address[..8]), // Default name using MAC prefix
            ip_address,
            resolution_width,
            resolution_height,
            active: false,
            last_seen: Utc::now(),
            display_config: DisplayConfig {
                resolution_width,
                resolution_height,
                elements: Vec::new(),
            },
        }
    }
}

impl NetworkDeviceConfig {
    fn default() -> NetworkDeviceConfig {
        NetworkDeviceConfig {
            id: Uuid::new_v4().to_string(),
            name: "A new device".to_string(),
            address: "".to_string(),
            active: false,
            display_config: Default::default(),
        }
    }
}

pub fn create_network_device_config() -> NetworkDeviceConfig {
    let new_config = NetworkDeviceConfig::default();
    write(&new_config);
    new_config
}

/// Registers a new client or updates existing client information
pub fn register_client(
    mac_address: String,
    ip_address: String,
    resolution_width: u32,
    resolution_height: u32,
) -> RegisteredClient {
    let mut config: AppConfig = read_from_app_config();

    let client = config
        .registered_clients
        .entry(mac_address.clone())
        .or_insert_with(|| {
            RegisteredClient::new(
                mac_address.clone(),
                ip_address.clone(),
                resolution_width,
                resolution_height,
            )
        });

    // Update client information
    client.ip_address = ip_address;
    client.resolution_width = resolution_width;
    client.resolution_height = resolution_height;
    client.last_seen = Utc::now();

    let client_clone = client.clone();
    write_to_app_config(&config);
    client_clone
}

/// Updates a client's name
pub fn update_client_name(mac_address: &str, name: String) -> Result<(), String> {
    let mut config: AppConfig = read_from_app_config();

    match config.registered_clients.get_mut(mac_address) {
        Some(client) => {
            client.name = name;
            write_to_app_config(&config);
            Ok(())
        }
        None => Err(format!("Client with MAC address {} not found", mac_address)),
    }
}

/// Enables/disables a client
pub fn set_client_active(mac_address: &str, active: bool) -> Result<(), String> {
    let mut config: AppConfig = read_from_app_config();

    match config.registered_clients.get_mut(mac_address) {
        Some(client) => {
            client.active = active;
            write_to_app_config(&config);
            Ok(())
        }
        None => Err(format!("Client with MAC address {} not found", mac_address)),
    }
}

/// Updates a client's display configuration
pub fn update_client_display_config(
    mac_address: &str,
    display_config: DisplayConfig,
) -> Result<(), String> {
    let mut config: AppConfig = read_from_app_config();

    match config.registered_clients.get_mut(mac_address) {
        Some(client) => {
            client.display_config = display_config;
            write_to_app_config(&config);
            Ok(())
        }
        None => Err(format!("Client with MAC address {} not found", mac_address)),
    }
}

/// Gets a registered client by MAC address
pub fn get_client(mac_address: &str) -> Option<RegisteredClient> {
    let config: AppConfig = read_from_app_config();
    config.registered_clients.get(mac_address).cloned()
}

/// Removes a client
pub fn remove_client(mac_address: &str) -> Result<(), String> {
    let mut config: AppConfig = read_from_app_config();

    match config.registered_clients.remove(mac_address) {
        Some(_) => {
            write_to_app_config(&config);
            Ok(())
        }
        None => Err(format!("Client with MAC address {} not found", mac_address)),
    }
}

/// Writes the specified config to disk.
/// If the config file does not exist, it will be created.
/// If the config file already exists, the specified config will be added to it.
pub fn write(_net_port_config: &NetworkDeviceConfig) {
    // Legacy function for backward compatibility
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
pub fn remove(_network_device_id: &str) {
    // Legacy function for backward compatibility - now a no-op
}

/// Loads the config file from disk.
/// If the file does not exist, it will be created.
/// Returns the config for the specified network device.
/// If no config for the specified network device exists, None is returned.
pub fn read(_network_device_id: &str) -> Option<NetworkDeviceConfig> {
    let _config: AppConfig = read_from_app_config();
    // For backward compatibility during migration
    None
}

/// Gets the HTTP server port from configuration
pub fn get_http_port() -> u16 {
    let config = read_from_app_config();
    config.http_port
}

/// Sets the HTTP server port in configuration
pub fn set_http_port(port: u16) -> Result<(), String> {
    if port == 0 || port < 1024 || port > 65535 {
        return Err("Port must be between 1024 and 65535".to_string());
    }

    let mut config = read_from_app_config();
    config.http_port = port;
    write_to_app_config(&config);
    Ok(())
}

/// Default HTTP port
fn default_http_port() -> u16 {
    25555
}

