use crate::config_file::AppConfig;
use crate::http_server::DisplayClient;
use sensor_core::ElementConfig;
use std::sync::Arc;
use tokio::sync::RwLock;

// Type alias
pub type InMemoryConfig = Arc<RwLock<AppConfig>>;

pub async fn update_client_name(
    in_memory_config: &InMemoryConfig,
    mac_address: &str,
    new_name: &str,
) {
    let mut config = in_memory_config.write().await;
    if let Some(client) = config.display_clients.get_mut(mac_address) {
        client.name = new_name.to_string();
        crate::config_file::write(&config);
    }
}

pub async fn remove_registered_client(in_memory_config: &InMemoryConfig, mac_address: &str) {
    let mut config = in_memory_config.write().await;
    if config.display_clients.remove(mac_address).is_some() {
        crate::config_file::write(&config);
    }
}

pub async fn set_client_active(in_memory_config: &InMemoryConfig, mac_address: &str, active: bool) {
    let mut config = in_memory_config.write().await;
    if let Some(client) = config.display_clients.get_mut(mac_address) {
        client.active = active;
        crate::config_file::write(&config);
    }
}

pub async fn update_client_display_config(
    in_memory_config: &InMemoryConfig,
    mac_address: &str,
    elements: Vec<ElementConfig>,
) {
    let mut config = in_memory_config.write().await;
    if let Some(client) = config.display_clients.get_mut(mac_address) {
        client.elements = elements;
        crate::config_file::write(&config);
    }
}

pub async fn get_client(
    in_memory_config: &InMemoryConfig,
    mac_address: &str,
) -> Option<DisplayClient> {
    let config = in_memory_config.read().await;
    config.display_clients.get(mac_address).cloned()
}

pub async fn get_port(in_memory_config: &InMemoryConfig) -> u16 {
    let config = in_memory_config.read().await;
    config.http_port
}

pub fn get_port_sync(in_memory_config: &InMemoryConfig) -> u16 {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(async { get_port(in_memory_config).await })
    })
}

pub async fn set_port(in_memory_config: &InMemoryConfig, port: u16) {
    let mut config = in_memory_config.write().await;
    config.http_port = port;
    crate::config_file::write(&config);
}

pub async fn create_or_update_client(
    in_memory_config: &InMemoryConfig,
    mac_address: &str,
    updated_client: DisplayClient,
) {
    let mut config = in_memory_config.write().await;
    config
        .display_clients
        .insert(mac_address.to_string(), updated_client);
    crate::config_file::write(&config);
}
