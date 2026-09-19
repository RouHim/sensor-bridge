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
    let updated_config = {
        let mut config = in_memory_config.write().await;
        match config.display_clients.get_mut(mac_address) {
            Some(client) => {
                client.name = new_name.to_string();
                Some(config.clone())
            }
            None => None,
        }
    };

    if let Some(config) = updated_config {
        crate::config_file::write_async(config).await;
    }
}

pub async fn remove_registered_client(in_memory_config: &InMemoryConfig, mac_address: &str) {
    let updated_config = {
        let mut config = in_memory_config.write().await;
        if config.display_clients.remove(mac_address).is_some() {
            Some(config.clone())
        } else {
            None
        }
    };

    if let Some(config) = updated_config {
        crate::config_file::write_async(config).await;
    }
}

pub async fn set_client_active(in_memory_config: &InMemoryConfig, mac_address: &str, active: bool) {
    let updated_config = {
        let mut config = in_memory_config.write().await;
        match config.display_clients.get_mut(mac_address) {
            Some(client) => {
                client.active = active;
                Some(config.clone())
            }
            None => None,
        }
    };

    if let Some(config) = updated_config {
        crate::config_file::write_async(config).await;
    }
}

pub async fn update_client_display_config(
    in_memory_config: &InMemoryConfig,
    mac_address: &str,
    elements: Vec<ElementConfig>,
) {
    let updated_config = {
        let mut config = in_memory_config.write().await;
        match config.display_clients.get_mut(mac_address) {
            Some(client) => {
                client.elements = elements;
                client.static_data_reload_required = true; // Set flag when elements change
                Some(config.clone())
            }
            None => None,
        }
    };

    if let Some(config) = updated_config {
        crate::config_file::write_async(config).await;
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

pub async fn set_port(in_memory_config: &InMemoryConfig, port: u16) {
    let updated_config = {
        let mut config = in_memory_config.write().await;
        config.http_port = port;
        config.clone()
    };

    crate::config_file::write_async(updated_config).await;
}

pub async fn create_or_update_client(
    in_memory_config: &InMemoryConfig,
    mac_address: &str,
    updated_client: DisplayClient,
) {
    let updated_config = {
        let mut config = in_memory_config.write().await;
        config
            .display_clients
            .insert(mac_address.to_string(), updated_client);
        config.clone()
    };

    crate::config_file::write_async(updated_config).await;
}
