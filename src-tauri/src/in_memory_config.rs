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
    // Ordered against every other commit: no older snapshot can win the rename race.
    let _persist = crate::config_file::lock_persist().await;
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
    // Ordered against every other commit: no older snapshot can win the rename race.
    let _persist = crate::config_file::lock_persist().await;
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
    // Ordered against every other commit: no older snapshot can win the rename race.
    let _persist = crate::config_file::lock_persist().await;
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
    // Ordered against every other commit: no older snapshot can win the rename race.
    let _persist = crate::config_file::lock_persist().await;
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
    // Ordered against every other commit: no older snapshot can win the rename race.
    let _persist = crate::config_file::lock_persist().await;
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
    // Ordered against every other commit: no older snapshot can win the rename race.
    let _persist = crate::config_file::lock_persist().await;
    let updated_config = {
        let mut config = in_memory_config.write().await;
        config
            .display_clients
            .insert(mac_address.to_string(), updated_client);
        config.clone()
    };

    crate::config_file::write_async(updated_config).await;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config_file::AppConfig;

    /// Every test in this binary shares `SENSOR_BRIDGE_APP_NAME`, which is process-wide:
    /// the lifecycle test in `main.rs` flips it too, so this test re-checks it and treats
    /// a flip (or a snapshot that is not ours at all) as interference rather than failure.
    const TEST_APP_NAME: &str = "sensor-bridge-persist-order-test";
    const CLIENT_COUNT: usize = 8;

    fn mac_address(index: usize) -> String {
        format!("AA:BB:CC:DD:EE:{:02X}", index)
    }

    fn test_client(index: usize) -> DisplayClient {
        DisplayClient::new(
            mac_address(index),
            format!("original-{}", index),
            "127.0.0.1".to_string(),
            320,
            240,
        )
    }

    /// Concurrent mutations must not lose updates: whatever order the blocking writes
    /// finish in, the file has to end up as the snapshot of the newest mutation, never as
    /// an older one whose rename happened to land last.
    #[test]
    fn concurrent_mutations_do_not_lose_updates() {
        let runtime = tokio::runtime::Runtime::new().unwrap();

        for _attempt in 0..5 {
            std::env::set_var("SENSOR_BRIDGE_APP_NAME", TEST_APP_NAME);

            let in_memory_config: InMemoryConfig = Arc::new(RwLock::new(AppConfig::default()));
            runtime.block_on(async {
                for index in 0..CLIENT_COUNT {
                    let client = test_client(index);
                    create_or_update_client(&in_memory_config, &mac_address(index), client).await;
                }

                let mut renames = Vec::new();
                for index in 0..CLIENT_COUNT {
                    let in_memory_config = in_memory_config.clone();
                    renames.push(tokio::spawn(async move {
                        update_client_name(
                            &in_memory_config,
                            &mac_address(index),
                            &format!("renamed-{}", index),
                        )
                        .await;
                    }));
                }

                for rename in renames {
                    rename.await.unwrap();
                }
            });

            // The sibling lifecycle test may have flipped the shared variable mid-round,
            // which would send part of our writes to a different directory.
            if std::env::var("SENSOR_BRIDGE_APP_NAME").as_deref() != Ok(TEST_APP_NAME) {
                continue;
            }
            std::env::set_var("SENSOR_BRIDGE_APP_NAME", TEST_APP_NAME);

            let persisted = crate::config_file::read();
            // A foreign snapshot can land in our directory between the last rename
            // and this read: the sibling lifecycle test's empty config, or the http
            // test's clients written through the same process-global app name.
            // The http test's clients are the trap: one of our MACs may appear in
            // its snapshot, so only a snapshot holding ALL of our clients counts as
            // ours - anything less is interference and is skipped, while a
            // genuinely lost update of ours is still asserted below.
            let owns_snapshot = (0..CLIENT_COUNT)
                .all(|index| persisted.display_clients.contains_key(&mac_address(index)));
            if !owns_snapshot {
                continue;
            }

            let persisted_renames = persisted
                .display_clients
                .values()
                .filter(|client| client.name.starts_with("renamed-"))
                .count();

            assert_eq!(
                persisted_renames, CLIENT_COUNT,
                "lost update: only {} of {} concurrent renames reached the config file",
                persisted_renames, CLIENT_COUNT
            );
            return;
        }

        panic!("the config file never settled - the lifecycle test kept interfering");
    }
}
