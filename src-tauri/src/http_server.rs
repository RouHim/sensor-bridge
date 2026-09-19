use chrono::Utc;
use log::info;
use sensor_core::{ElementConfig, StaticClientData};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use tokio::sync::oneshot;
use tokio::task::JoinHandle;
use warp::Filter;

// Add imports for static data preparation
use crate::in_memory_config::InMemoryConfig;
use crate::utils::LockResultExt;
use crate::{conditional_image, in_memory_config, static_image, text};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplayClient {
    pub mac_address: String,
    pub name: String,
    pub ip_address: String,
    pub resolution_width: u16,
    pub resolution_height: u16,
    pub active: bool,
    pub elements: Vec<ElementConfig>,
    pub static_data_reload_required: bool,
}

impl DisplayClient {
    pub fn new(
        mac_address: String,
        name: String,
        ip_address: String,
        resolution_width: u16,
        resolution_height: u16,
    ) -> Self {
        Self {
            mac_address,
            name,
            ip_address,
            resolution_width,
            resolution_height,
            active: false, // Clients start inactive, must be activated via UI
            elements: Vec::new(),
            static_data_reload_required: true, // New clients need initial static data
        }
    }
}

#[derive(Debug)]
pub enum ApiError {
    NotRegistered,
    NotActive,
    NotReady,
    StaticDataUnavailable,
    BadRequest(String),
}

impl warp::reject::Reject for ApiError {}

/// Builds the HTTP API routes. Factored out of `start_server` so that the
/// handler contract is testable without binding a socket.
pub fn routes(
    in_memory_config: InMemoryConfig,
    sensor_snapshot: Arc<RwLock<Option<crate::sensor::SensorSnapshot>>>,
    static_data_cache: crate::static_data_cache::StaticDataCacheHandle,
) -> impl Filter<Extract = (impl warp::Reply,), Error = warp::Rejection> + Clone {
    // Create filter helpers
    let in_memory_config_filter = warp::any().map({
        let config = in_memory_config.clone();
        move || config.clone()
    });
    let sensor_snapshot_filter = warp::any().map({
        let snapshot = sensor_snapshot.clone();
        move || snapshot.clone()
    });
    let static_data_cache_filter = warp::any().map({
        let cache = static_data_cache.clone();
        move || cache.clone()
    });

    // Health check endpoint
    let health = warp::path("health")
        .and(warp::path::end())
        .and(warp::get())
        .map(|| {
            warp::reply::json(&serde_json::json!({
                "status": "healthy",
                "service": "sensor-bridge",
                "protocol_version": sensor_core::PROTOCOL_VERSION,
                "timestamp": Utc::now().timestamp()
            }))
        });

    // Registration endpoint
    let register = warp::path("api")
        .and(warp::path("register"))
        .and(warp::path::end())
        .and(warp::post())
        .and(warp::body::json())
        .and(in_memory_config_filter.clone())
        .and_then(handle_client_registration);

    // Static data endpoint
    let static_data_route = warp::path("api")
        .and(warp::path("static-data"))
        .and(warp::path::end())
        .and(warp::get())
        .and(warp::query::<HashMap<String, String>>())
        .and(in_memory_config_filter.clone())
        .and(static_data_cache_filter)
        .and_then(handle_static_data_request);

    // Static data confirmation endpoint
    let static_data_ack_route = warp::path("api")
        .and(warp::path("static-data"))
        .and(warp::path("ack"))
        .and(warp::path::end())
        .and(warp::post())
        .and(warp::body::json())
        .and(in_memory_config_filter.clone())
        .and_then(handle_static_data_ack);

    // Sensor data endpoint with client verification
    let api_sensor_data = warp::path("api")
        .and(warp::path("sensor-data"))
        .and(warp::path::end())
        .and(warp::get())
        .and(warp::query::<HashMap<String, String>>())
        .and(in_memory_config_filter)
        .and(sensor_snapshot_filter)
        .and_then(handle_sensor_data_request);

    // Combine routes with proper error handling
    health
        .or(api_sensor_data)
        .or(register)
        .or(static_data_ack_route)
        .or(static_data_route)
        .recover(handle_rejection)
        .with(warp::cors().allow_any_origin())
}

pub async fn start_server(
    port: u16,
    sensor_snapshot: Arc<RwLock<Option<crate::sensor::SensorSnapshot>>>,
    static_data_cache: crate::static_data_cache::StaticDataCacheHandle,
    shutdown_rx: oneshot::Receiver<()>,
    in_memory_config: InMemoryConfig,
) -> Result<JoinHandle<()>, Box<dyn std::error::Error + Send + Sync>> {
    info!("Starting HTTP server on port {}", port);

    let routes = routes(in_memory_config, sensor_snapshot, static_data_cache);

    // Start the server with graceful shutdown
    let server = warp::serve(routes)
        .bind(([0, 0, 0, 0], port))
        .await
        .graceful(async move {
            // Wait for the shutdown signal
            let _ = shutdown_rx.await;
            info!(
                "Graceful shutdown initiated for HTTP server on port {}",
                port
            );
        });

    info!("HTTP server bound to port {}", port);
    let handle = tokio::spawn(server.run());

    Ok(handle)
}

async fn handle_sensor_data_request(
    params: HashMap<String, String>,
    in_memory_config: InMemoryConfig,
    sensor_snapshot: Arc<RwLock<Option<crate::sensor::SensorSnapshot>>>,
) -> Result<impl warp::Reply, warp::Rejection> {
    // Extract and validate MAC address parameter
    let mac_address = params
        .get("mac_address")
        .ok_or_else(|| {
            warp::reject::custom(ApiError::BadRequest(
                "mac_address parameter required".to_string(),
            ))
        })?
        .to_string();

    // Normalize MAC address format
    let normalized_mac = sensor_core::normalize_mac(&mac_address);

    let guard = in_memory_config.read().await;
    let display_clients = &guard.display_clients;
    match display_clients.get(&normalized_mac) {
        None => {
            // Client not registered - return 404
            info!("Client {} not registered", mac_address);
            Err(warp::reject::custom(ApiError::NotRegistered))
        }
        Some(client) if !client.active => {
            // Client registered but not active - return 403
            info!("Client {} not active", mac_address);
            Err(warp::reject::custom(ApiError::NotActive))
        }
        Some(client) => {
            // Client is registered and active - serve the latest cached snapshot
            let current_sensor_values = sensor_snapshot
                .read()
                .ignore_poison()
                .as_ref()
                .map(|snapshot| snapshot.values.clone())
                .ok_or_else(|| warp::reject::custom(ApiError::NotReady))?;

            let render_data = serde_json::json!({
                "elements": client.elements,
                "sensor_values": current_sensor_values
            });

            let response = serde_json::json!({
                "render_data": render_data,
                "static_data_reload_required": client.static_data_reload_required
            });

            Ok(warp::reply::json(&response))
        }
    }
}

async fn handle_client_registration(
    registration: serde_json::Value,
    in_memory_config: InMemoryConfig,
) -> Result<impl warp::Reply, warp::Rejection> {
    info!("Client registration request: {:?}", registration);

    // Extract and validate registration data
    let mac_address = registration["mac_address"].as_str().ok_or_else(|| {
        warp::reject::custom(ApiError::BadRequest("mac_address is required".to_string()))
    })?;

    let ip_address = registration["ip_address"].as_str().ok_or_else(|| {
        warp::reject::custom(ApiError::BadRequest("ip_address is required".to_string()))
    })?;

    let width = registration["resolution_width"].as_u64().ok_or_else(|| {
        warp::reject::custom(ApiError::BadRequest(
            "resolution_width is required".to_string(),
        ))
    })? as u16;

    let height = registration["resolution_height"].as_u64().ok_or_else(|| {
        warp::reject::custom(ApiError::BadRequest(
            "resolution_height is required".to_string(),
        ))
    })? as u16;

    // Normalize MAC address
    let normalized_mac = mac_address.to_uppercase();

    let maybe_client = in_memory_config
        .read()
        .await
        .display_clients
        .get(&normalized_mac)
        .cloned();

    // Check if client already exists in config
    let client = if let Some(mut existing_client) = maybe_client {
        // Update existing client
        existing_client.ip_address = ip_address.to_string();
        existing_client.resolution_width = width;
        existing_client.resolution_height = height;

        info!("Updated existing client: {}", normalized_mac);
        existing_client
    } else {
        // Create new client
        let new_client = DisplayClient::new(
            normalized_mac.clone(),
            format!("Device: {}", mac_address),
            ip_address.to_string(),
            width,
            height,
        );

        info!("Registered new client: {}", normalized_mac);
        new_client
    };

    // Save client to config
    in_memory_config::create_or_update_client(&in_memory_config, &normalized_mac, client.clone())
        .await;

    // Return JSON confirmation (NO static data)
    Ok(warp::reply::json(&serde_json::json!({
        "success": true,
        "message": "Client registered successfully",
        "protocol_version": sensor_core::PROTOCOL_VERSION,
        "mac_address": normalized_mac
    })))
}

async fn handle_static_data_request(
    params: HashMap<String, String>,
    in_memory_config: InMemoryConfig,
    static_data_cache: crate::static_data_cache::StaticDataCacheHandle,
) -> Result<impl warp::Reply, warp::Rejection> {
    let mac_address = params.get("mac_address").ok_or_else(|| {
        warp::reject::custom(ApiError::BadRequest("mac_address required".to_string()))
    })?;
    let mac_address = sensor_core::normalize_mac(mac_address);

    // Verify the client exists and is active. The reload flag is deliberately
    // NOT touched here: it clears only through POST /api/static-data/ack, after
    // the client persisted the delivered payload.
    let elements = {
        let guard = in_memory_config.read().await;
        let client = guard
            .display_clients
            .get(&mac_address)
            .ok_or_else(|| warp::reject::custom(ApiError::NotRegistered))?;

        if !client.active {
            return Err(warp::reject::custom(ApiError::NotActive));
        }

        client.elements.clone()
    };

    // Preparation performs network and disk I/O - keep it off the async workers.
    let prepared = tokio::task::spawn_blocking(move || {
        let mut cache = static_data_cache.lock().ignore_poison();
        cache.get_or_prepare(&elements, prepare_static_data_for_client)
    })
    .await
    .map_err(|_| warp::reject::custom(ApiError::StaticDataUnavailable))?
    .map_err(|err| {
        log::error!("Failed to prepare static data: {}", err);
        warp::reject::custom(ApiError::StaticDataUnavailable)
    })?;

    let reply = warp::reply::with_header(
        (*prepared.bytes).clone(),
        "content-type",
        "application/octet-stream",
    );
    let reply = warp::reply::with_header(reply, "x-static-data-revision", prepared.revision);
    let reply = warp::reply::with_header(
        reply,
        "x-protocol-version",
        sensor_core::PROTOCOL_VERSION.to_string(),
    );

    Ok(reply)
}

/// Request body of `POST /api/static-data/ack`.
#[derive(Debug, Deserialize)]
pub struct StaticDataAckRequest {
    pub mac_address: String,
    pub revision: String,
}

/// Clears a client's static-data reload flag after the client persisted the
/// payload. Only a confirmation for the revision that is current for the
/// client's elements clears the flag, so a stale confirmation can never
/// discard a newer pending update. Repeated confirmations are idempotent.
async fn handle_static_data_ack(
    ack: StaticDataAckRequest,
    in_memory_config: InMemoryConfig,
) -> Result<impl warp::Reply, warp::Rejection> {
    let mac_address = sensor_core::normalize_mac(&ack.mac_address);

    // Ordered against every other commit: no older snapshot can win the rename race.
    let _persist = crate::config_file::lock_persist().await;

    // Revision check and flag update happen under the same write guard, so an
    // element change between them cannot be confirmed away by a stale ack.
    let (pending_cleared, updated_config) = {
        let mut config = in_memory_config.write().await;
        let client = config
            .display_clients
            .get_mut(&mac_address)
            .ok_or_else(|| warp::reject::custom(ApiError::NotRegistered))?;

        if !client.active {
            return Err(warp::reject::custom(ApiError::NotActive));
        }

        let current_revision = crate::static_data_cache::elements_revision(&client.elements)
            .map_err(|err| {
                log::error!("Failed to compute elements revision: {}", err);
                warp::reject::custom(ApiError::StaticDataUnavailable)
            })?;

        if client.static_data_reload_required && ack.revision == current_revision {
            client.static_data_reload_required = false;
            (true, Some(config.clone()))
        } else {
            (false, None)
        }
    };

    if let Some(config) = updated_config {
        crate::config_file::write_async(config).await;
    }

    Ok(warp::reply::json(&serde_json::json!({
        "success": true,
        "pending_cleared": pending_cleared
    })))
}

/// Prepares all static data for the client (text, static images, conditional images)
/// and serializes it. Fails when any required asset cannot be prepared or
/// serialization fails, so a degraded payload is never served as success.
fn prepare_static_data_for_client(elements: &[ElementConfig]) -> Result<Vec<u8>, String> {
    info!("Preparing static data for client");

    let static_data = StaticClientData {
        text_data: text::build_fonts_data(elements)?,
        static_image_data: static_image::get_preparation_data(elements)?,
        conditional_image_data: conditional_image::get_preparation_data(elements)?,
    };

    let binary_data = crate::serialization::encode(&static_data)?;
    info!("Serialized static data: {} bytes", binary_data.len());

    Ok(binary_data)
}

async fn handle_rejection(
    err: warp::Rejection,
) -> Result<impl warp::Reply, std::convert::Infallible> {
    let (code, message) = if let Some(api_error) = err.find::<ApiError>() {
        match api_error {
            ApiError::NotRegistered => (warp::http::StatusCode::NOT_FOUND, "Client not registered"),
            ApiError::NotActive => (warp::http::StatusCode::FORBIDDEN, "Client not active"),
            ApiError::NotReady => (
                warp::http::StatusCode::SERVICE_UNAVAILABLE,
                "No sensor sample available yet",
            ),
            ApiError::StaticDataUnavailable => (
                warp::http::StatusCode::INTERNAL_SERVER_ERROR,
                "Static data unavailable",
            ),
            ApiError::BadRequest(msg) => (warp::http::StatusCode::BAD_REQUEST, msg.as_str()),
        }
    } else if err.is_not_found() {
        (warp::http::StatusCode::NOT_FOUND, "Endpoint not found")
    } else if err
        .find::<warp::filters::body::BodyDeserializeError>()
        .is_some()
    {
        (warp::http::StatusCode::BAD_REQUEST, "Invalid JSON body")
    } else {
        (
            warp::http::StatusCode::INTERNAL_SERVER_ERROR,
            "Internal server error",
        )
    };

    let json = warp::reply::json(&serde_json::json!({
        "error": message,
        "status": code.as_u16()
    }));

    Ok(warp::reply::with_status(json, code))
}

#[cfg(test)]
mod preparation_tests {
    use super::*;
    use sensor_core::ElementType;

    fn test_font_family() -> String {
        crate::fonts::get_all()
            .first()
            .cloned()
            .expect("this test needs at least one system font")
    }

    fn text_element(id: &str) -> ElementConfig {
        ElementConfig {
            id: id.to_string(),
            element_type: ElementType::Text,
            text_config: Some(sensor_core::TextConfig {
                font_family: test_font_family(),
                format: "{value}".to_string(),
                ..Default::default()
            }),
            ..Default::default()
        }
    }

    fn missing_image_element(id: &str) -> ElementConfig {
        ElementConfig {
            id: id.to_string(),
            element_type: ElementType::StaticImage,
            image_config: Some(sensor_core::ImageConfig {
                width: 4,
                height: 4,
                image_path: "/definitely/not/a/real/image.png".to_string(),
            }),
            ..Default::default()
        }
    }

    #[test]
    fn empty_element_list_prepares_an_empty_payload() {
        let payload = prepare_static_data_for_client(&[]).expect("no elements is not a failure");
        assert!(
            !payload.is_empty(),
            "an empty StaticClientData still serializes to bytes"
        );
    }

    #[test]
    fn missing_image_file_fails_preparation() {
        let result = prepare_static_data_for_client(&[missing_image_element("broken")]);
        assert!(
            result.is_err(),
            "a missing asset must not degrade into an empty payload"
        );
    }

    #[test]
    fn unknown_font_failure_is_reported() {
        let mut element = text_element("unknown-font");
        element.text_config.as_mut().unwrap().font_family =
            "Definitely Not A Font 12345".to_string();

        let result = prepare_static_data_for_client(&[element]);
        assert!(result.is_err(), "an unloadable font must fail preparation");
    }
}
