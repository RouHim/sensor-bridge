use chrono::Utc;
use log::info;
use sensor_core::{ElementConfig, StaticClientData};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, RwLock};
use tokio::sync::oneshot;
use tokio::task::JoinHandle;
use warp::{Filter, Reply};

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

/// API response version of RegisteredClient with formatted timestamp
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RegisteredClientResponse {
    pub mac_address: String,
    pub name: String,
    pub ip_address: String,
    pub resolution_width: u16,
    pub resolution_height: u16,
    pub active: bool,
    pub elements: Vec<ElementConfig>,
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

impl From<DisplayClient> for RegisteredClientResponse {
    fn from(client: DisplayClient) -> Self {
        RegisteredClientResponse {
            mac_address: client.mac_address,
            name: client.name,
            ip_address: client.ip_address,
            resolution_width: client.resolution_width,
            resolution_height: client.resolution_height,
            active: client.active,
            elements: client.elements,
        }
    }
}

#[derive(Debug)]
pub enum ApiError {
    NotRegistered,
    NotActive,
    NotReady,
    BadRequest(String),
}

impl warp::reject::Reject for ApiError {}

pub async fn start_server(
    port: u16,
    sensor_snapshot: Arc<RwLock<Option<crate::sensor::SensorSnapshot>>>,
    sensor_value_history: Arc<RwLock<VecDeque<Vec<sensor_core::SensorValue>>>>,
    shutdown_rx: oneshot::Receiver<()>,
    in_memory_config: InMemoryConfig,
) -> Result<JoinHandle<()>, Box<dyn std::error::Error + Send + Sync>> {
    info!("Starting HTTP server on port {}", port);

    // Create filter helpers
    let in_memory_config_filter = warp::any().map({
        let config = in_memory_config.clone();
        move || config.clone()
    });
    let sensor_snapshot_filter = warp::any().map({
        let snapshot = sensor_snapshot.clone();
        move || snapshot.clone()
    });
    let sensor_history_filter = warp::any().map({
        let history = sensor_value_history.clone();
        move || history.clone()
    });

    // Health check endpoint
    let health = warp::path("health").and(warp::get()).map(|| {
        warp::reply::json(&serde_json::json!({
            "status": "healthy",
            "service": "sensor-bridge",
            "timestamp": Utc::now().timestamp()
        }))
    });

    // Registration endpoint
    let register = warp::path("api")
        .and(warp::path("register"))
        .and(warp::post())
        .and(warp::body::json())
        .and(in_memory_config_filter.clone())
        .and_then(handle_client_registration);

    // Static data endpoint
    let static_data_route = warp::path("api")
        .and(warp::path("static-data"))
        .and(warp::get())
        .and(warp::query::<HashMap<String, String>>())
        .and(in_memory_config_filter.clone())
        .and_then(handle_static_data_request);

    // Sensor data endpoint with client verification
    let api_sensor_data = warp::path("api")
        .and(warp::path("sensor-data"))
        .and(warp::get())
        .and(warp::query::<HashMap<String, String>>())
        .and(in_memory_config_filter.clone())
        .and(sensor_snapshot_filter)
        .and(sensor_history_filter)
        .and_then(handle_sensor_data_request);

    // Combine routes with proper error handling
    let routes = health
        .or(api_sensor_data)
        .or(register)
        .or(static_data_route)
        .recover(handle_rejection)
        .with(warp::cors().allow_any_origin());

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
    _sensor_value_history: Arc<RwLock<VecDeque<Vec<sensor_core::SensorValue>>>>,
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
    let normalized_mac = mac_address.to_uppercase();

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

        info!("Updated existing client: {}", &normalized_mac);
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

        info!("Registered new client: {}", &normalized_mac);
        new_client
    };

    // Save client to config
    in_memory_config::create_or_update_client(&in_memory_config, &normalized_mac, client.clone())
        .await;

    // Return JSON confirmation (NO static data)
    Ok(warp::reply::json(&serde_json::json!({
        "success": true,
        "message": "Client registered successfully",
        "mac_address": normalized_mac
    })))
}

async fn handle_static_data_request(
    params: HashMap<String, String>,
    in_memory_config: InMemoryConfig,
) -> Result<impl warp::Reply, warp::Rejection> {
    let mac_address = params.get("mac_address").ok_or_else(|| {
        warp::reject::custom(ApiError::BadRequest("mac_address required".to_string()))
    })?;

    // Verify client exists and is active
    let elements = {
        let guard = in_memory_config.read().await;
        let client = guard
            .display_clients
            .get(mac_address)
            .ok_or_else(|| warp::reject::custom(ApiError::NotRegistered))?;

        if !client.active {
            return Err(warp::reject::custom(ApiError::NotActive));
        }

        client.elements.clone()
    };

    // Reset the reload flag now that we're serving the static data
    {
        let mut guard = in_memory_config.write().await;
        if let Some(client) = guard.display_clients.get_mut(mac_address) {
            client.static_data_reload_required = false;
            crate::config_file::write(&guard);
        }
    }

    // Prepare and return static data. A preparation failure must not be answered
    // with a degraded payload, so it becomes a 5xx instead.
    let response = match prepare_static_data_for_client(&elements) {
        Ok(static_bincode_data) => warp::reply::with_header(
            static_bincode_data,
            "content-type",
            "application/octet-stream",
        )
        .into_response(),
        Err(err) => {
            log::error!("Failed to prepare static data: {}", err);
            warp::reply::with_status(
                warp::reply::json(&serde_json::json!({
                    "error": "Failed to prepare static data",
                    "status": 500
                })),
                warp::http::StatusCode::INTERNAL_SERVER_ERROR,
            )
            .into_response()
        }
    };

    Ok(response)
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
