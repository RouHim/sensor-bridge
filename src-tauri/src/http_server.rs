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
    BadRequest(String),
}

impl warp::reject::Reject for ApiError {}

pub async fn start_server(
    port: u16,
    sensor_values: Arc<Vec<sensor_core::SensorValue>>,
    sensor_value_history: Arc<RwLock<Vec<Vec<sensor_core::SensorValue>>>>,
    shutdown_rx: oneshot::Receiver<()>,
    in_memory_config: InMemoryConfig,
) -> Result<JoinHandle<()>, Box<dyn std::error::Error + Send + Sync>> {
    info!("Starting HTTP server on port {}", port);

    // Create filter helpers
    let in_memory_config_filter = warp::any().map({
        let config = in_memory_config.clone();
        move || config.clone()
    });
    let sensor_values_filter = warp::any().map({
        let values = sensor_values.clone();
        move || values.clone()
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
        .and(sensor_values_filter)
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
    let (addr, server) =
        warp::serve(routes).bind_with_graceful_shutdown(([0, 0, 0, 0], port), async move {
            // Wait for the shutdown signal
            let _ = shutdown_rx.await;
            info!(
                "Graceful shutdown initiated for HTTP server on port {}",
                port
            );
        });

    info!("HTTP server bound to address: {}", addr);
    let handle = tokio::spawn(server);

    Ok(handle)
}

async fn handle_sensor_data_request(
    params: HashMap<String, String>,
    in_memory_config: InMemoryConfig,
    sensor_values: Arc<Vec<sensor_core::SensorValue>>,
    sensor_history: Arc<RwLock<Vec<Vec<sensor_core::SensorValue>>>>,
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
            // Client is registered and active - update last seen and return data
            info!("Serving sensor data to client {}", mac_address);

            // Create client-specific render data
            let current_sensor_values =
                crate::sensor::read_all_sensor_values(&sensor_history, &sensor_values);

            let render_data = serde_json::json!({
                "elements": client.elements,
                "sensor_values": current_sensor_values
            });

            let response = serde_json::json!({
                "render_data": render_data,
                "timestamp": Utc::now().timestamp(),
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

    // Prepare and return static data
    let static_bincode_data = prepare_static_data_for_client(&elements);

    Ok(warp::reply::with_header(
        static_bincode_data,
        "content-type",
        "application/octet-stream",
    ))
}

/// Prepares all static data for the client (text, static images, conditional images)
/// This is done by gathering data from all elements and serializing it
/// Returns the data serialized as binary using bincode
fn prepare_static_data_for_client(elements: &[ElementConfig]) -> Vec<u8> {
    info!("Preparing static data for client");

    // Prepare text data (fonts)
    let text_data = text::build_fonts_data(elements);

    // Prepare static image data
    let static_image_data = static_image::get_preparation_data(elements);

    // Prepare conditional image data
    let conditional_image_data = conditional_image::get_preparation_data(elements);

    // Bundle all data together
    let static_data = StaticClientData {
        text_data,
        static_image_data,
        conditional_image_data,
    };

    // Serialize to binary format using bincode
    match bincode::serialize(&static_data) {
        Ok(binary_data) => {
            info!("Serialized static data: {} bytes", binary_data.len());
            binary_data
        }
        Err(e) => {
            log::error!("Failed to serialize static data: {}", e);
            // Return empty data on error
            bincode::serialize(&StaticClientData {
                text_data: HashMap::new(),
                static_image_data: HashMap::new(),
                conditional_image_data: HashMap::new(),
            })
            .unwrap_or_default()
        }
    }
}

async fn handle_rejection(
    err: warp::Rejection,
) -> Result<impl warp::Reply, std::convert::Infallible> {
    let (code, message) = if let Some(api_error) = err.find::<ApiError>() {
        match api_error {
            ApiError::NotRegistered => (warp::http::StatusCode::NOT_FOUND, "Client not registered"),
            ApiError::NotActive => (warp::http::StatusCode::FORBIDDEN, "Client not active"),
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
