use axum::{
    extract::{Json, Query, State},
    http::StatusCode,
    response::Json as ResponseJson,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tower_http::cors::CorsLayer;
use log::{info, error, warn};

use crate::config::{self, RegisteredClient};
use sensor_core::{DisplayConfig, RenderData, SensorValue};

const DEFAULT_SERVER_PORT: u16 = 8080;

/// HTTP server state shared across requests
#[derive(Clone)]
pub struct HttpServerState {
    pub sensor_values: Arc<Vec<SensorValue>>,
    pub sensor_value_history: Arc<Mutex<Vec<Vec<SensorValue>>>>,
}

/// Client registration request payload
#[derive(Deserialize, Serialize, Debug)]
pub struct ClientRegistration {
    pub mac_address: String,
    pub ip_address: String,
    pub resolution_width: u32,
    pub resolution_height: u32,
    pub name: Option<String>,
}

/// Client registration response
#[derive(Serialize)]
pub struct RegistrationResponse {
    pub success: bool,
    pub message: String,
    pub client: Option<RegisteredClient>,
}

/// Sensor data response for clients
#[derive(Serialize)]
pub struct SensorDataResponse {
    pub render_data: RenderData,
    pub timestamp: u64,
}

/// Query parameters for sensor data endpoint
#[derive(Deserialize)]
pub struct SensorDataQuery {
    pub mac_address: String,
}

/// Update client name request
#[derive(Deserialize)]
pub struct UpdateClientNameRequest {
    pub mac_address: String,
    pub name: String,
}

/// Update client display config request
#[derive(Deserialize)]
pub struct UpdateDisplayConfigRequest {
    pub mac_address: String,
    pub display_config: DisplayConfig,
}

/// Starts the HTTP server on the specified port
pub async fn start_http_server(
    sensor_values: Arc<Vec<SensorValue>>,
    sensor_value_history: Arc<Mutex<Vec<Vec<SensorValue>>>>,
    port: Option<u16>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let port = port.unwrap_or(DEFAULT_SERVER_PORT);

    let state = HttpServerState {
        sensor_values,
        sensor_value_history,
    };

    let app = Router::new()
        .route("/api/register", post(register_client))
        .route("/api/clients", get(list_clients))
        .route("/api/clients/update-name", post(update_client_name))
        .route("/api/clients/set-active", post(set_client_active))
        .route("/api/clients/display-config", post(update_display_config))
        .route("/api/clients/:mac_address", axum::routing::delete(remove_client))
        .route("/api/sensor-data", get(get_sensor_data))
        .route("/api/health", get(health_check))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = format!("0.0.0.0:{}", port);
    info!("Starting HTTP server on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// Registers a new client or updates existing client information
async fn register_client(
    State(_state): State<HttpServerState>,
    Json(registration): Json<ClientRegistration>,
) -> Result<ResponseJson<RegistrationResponse>, StatusCode> {
    info!(
        "Client registration request: MAC={}, IP={}, Resolution={}x{}",
        registration.mac_address,
        registration.ip_address,
        registration.resolution_width,
        registration.resolution_height
    );

    let mut client = config::register_client(
        registration.mac_address.clone(),
        registration.ip_address,
        registration.resolution_width,
        registration.resolution_height,
    );

    // Update name if provided
    if let Some(ref name) = registration.name {
        if let Err(e) = config::update_client_name(&registration.mac_address, name.clone()) {
            warn!("Failed to update client name: {}", e);
        } else {
            client.name = name.clone();
        }
    }

    Ok(ResponseJson(RegistrationResponse {
        success: true,
        message: "Client registered successfully".to_string(),
        client: Some(client),
    }))
}

/// Lists all registered clients
async fn list_clients(
    State(_state): State<HttpServerState>,
) -> Result<ResponseJson<HashMap<String, RegisteredClient>>, StatusCode> {
    let config = config::read_from_app_config();
    Ok(ResponseJson(config.registered_clients))
}

/// Updates a client's name
async fn update_client_name(
    State(_state): State<HttpServerState>,
    Json(request): Json<UpdateClientNameRequest>,
) -> Result<ResponseJson<RegistrationResponse>, StatusCode> {
    match config::update_client_name(&request.mac_address, request.name) {
        Ok(_) => Ok(ResponseJson(RegistrationResponse {
            success: true,
            message: "Client name updated successfully".to_string(),
            client: config::get_client(&request.mac_address),
        })),
        Err(e) => {
            error!("Failed to update client name: {}", e);
            Err(StatusCode::NOT_FOUND)
        }
    }
}

/// Sets a client's active status
async fn set_client_active(
    State(_state): State<HttpServerState>,
    Json(request): Json<serde_json::Value>,
) -> Result<ResponseJson<RegistrationResponse>, StatusCode> {
    let mac_address = request["mac_address"].as_str().unwrap_or("");
    let active = request["active"].as_bool().unwrap_or(false);

    match config::set_client_active(mac_address, active) {
        Ok(_) => Ok(ResponseJson(RegistrationResponse {
            success: true,
            message: format!("Client {} {}", if active { "enabled" } else { "disabled" }, "successfully"),
            client: config::get_client(mac_address),
        })),
        Err(e) => {
            error!("Failed to update client status: {}", e);
            Err(StatusCode::NOT_FOUND)
        }
    }
}

/// Updates a client's display configuration
async fn update_display_config(
    State(_state): State<HttpServerState>,
    Json(request): Json<UpdateDisplayConfigRequest>,
) -> Result<ResponseJson<RegistrationResponse>, StatusCode> {
    match config::update_client_display_config(&request.mac_address, request.display_config) {
        Ok(_) => Ok(ResponseJson(RegistrationResponse {
            success: true,
            message: "Display configuration updated successfully".to_string(),
            client: config::get_client(&request.mac_address),
        })),
        Err(e) => {
            error!("Failed to update display configuration: {}", e);
            Err(StatusCode::NOT_FOUND)
        }
    }
}

/// Removes a client
async fn remove_client(
    State(_state): State<HttpServerState>,
    axum::extract::Path(mac_address): axum::extract::Path<String>,
) -> Result<ResponseJson<RegistrationResponse>, StatusCode> {
    match config::remove_client(&mac_address) {
        Ok(_) => Ok(ResponseJson(RegistrationResponse {
            success: true,
            message: "Client removed successfully".to_string(),
            client: None,
        })),
        Err(e) => {
            error!("Failed to remove client: {}", e);
            Err(StatusCode::NOT_FOUND)
        }
    }
}

/// Provides sensor data for registered clients
async fn get_sensor_data(
    State(state): State<HttpServerState>,
    Query(params): Query<SensorDataQuery>,
) -> Result<ResponseJson<SensorDataResponse>, StatusCode> {
    // Check if client is registered and active
    let client = match config::get_client(&params.mac_address) {
        Some(client) => client,
        None => {
            warn!("Sensor data requested for unregistered client: {}", params.mac_address);
            return Err(StatusCode::NOT_FOUND);
        }
    };

    if !client.active {
        warn!("Sensor data requested for inactive client: {}", params.mac_address);
        return Err(StatusCode::FORBIDDEN);
    }

    // Read current sensor values
    let sensor_values = crate::sensor::read_all_sensor_values(
        &state.sensor_value_history,
        &state.sensor_values,
    );

    let render_data = RenderData {
        display_config: client.display_config,
        sensor_values,
    };

    Ok(ResponseJson(SensorDataResponse {
        render_data,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    }))
}

/// Health check endpoint
async fn health_check() -> ResponseJson<serde_json::Value> {
    ResponseJson(serde_json::json!({
        "status": "healthy",
        "service": "sensor-bridge",
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }))
}
