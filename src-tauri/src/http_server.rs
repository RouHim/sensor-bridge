use std::sync::{Arc, Mutex};
use tokio::task::JoinHandle;
use warp::Filter;
use log::info;
use serde_json;
use std::collections::HashMap;
use tokio::sync::RwLock;
use chrono::Utc;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisteredClient {
    pub mac_address: String,
    pub name: String,
    pub ip_address: String,
    pub resolution_width: u32,
    pub resolution_height: u32,
    pub active: bool,
    pub last_seen: u64,
    pub registered_at: u64,
    pub display_config: sensor_core::DisplayConfig,
}

impl RegisteredClient {
    pub fn new(
        mac_address: String,
        name: String,
        ip_address: String,
        resolution_width: u32,
        resolution_height: u32,
    ) -> Self {
        let now = Utc::now().timestamp() as u64;
        Self {
            mac_address,
            name,
            ip_address,
            resolution_width,
            resolution_height,
            active: false, // Clients start inactive, must be activated via UI
            last_seen: now,
            registered_at: now,
            display_config: sensor_core::DisplayConfig {
                resolution_width,
                resolution_height,
                elements: Vec::new(),
            },
        }
    }

    pub fn update_last_seen(&mut self) {
        self.last_seen = Utc::now().timestamp() as u64;
    }

    pub fn is_recently_active(&self, timeout_seconds: u64) -> bool {
        let now = Utc::now().timestamp() as u64;
        (now - self.last_seen) < timeout_seconds
    }
}

pub type ClientRegistry = Arc<RwLock<HashMap<String, RegisteredClient>>>;

#[derive(Debug)]
pub enum ApiError {
    NotRegistered,
    NotActive,
    BadRequest(String),
    InternalError(String),
}

impl warp::reject::Reject for ApiError {}

pub struct HttpServerState {
    pub handle: Option<JoinHandle<()>>,
    pub is_running: bool,
}

impl HttpServerState {
    pub fn new() -> Self {
        Self {
            handle: None,
            is_running: false,
        }
    }
}

pub async fn start_server(
    port: u16,
    sensor_values: Arc<Vec<sensor_core::SensorValue>>,
    sensor_value_history: Arc<Mutex<Vec<Vec<sensor_core::SensorValue>>>>,
) -> Result<JoinHandle<()>, Box<dyn std::error::Error + Send + Sync>> {
    info!("Starting HTTP server on port {}", port);

    // Initialize client registry
    let client_registry: ClientRegistry = Arc::new(RwLock::new(HashMap::new()));
    
    // Load existing clients from config system into registry
    load_existing_clients_into_registry(&client_registry).await;

    // Create filter helpers
    let client_registry_filter = warp::any().map({
        let registry = client_registry.clone();
        move || registry.clone()
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
    let health = warp::path("health")
        .and(warp::get())
        .map(|| {
            warp::reply::json(&serde_json::json!({
                "status": "healthy",
                "service": "sensor-bridge",
                "timestamp": Utc::now().timestamp()
            }))
        });

    // sensor data endpoint with client verification
    let api_sensor_data = warp::path("api")
        .and(warp::path("sensor-data"))
        .and(warp::get())
        .and(warp::query::<HashMap<String, String>>())
        .and(client_registry_filter.clone())
        .and(sensor_values_filter)
        .and(sensor_history_filter)
        .and_then(handle_sensor_data_request);

    // Registration endpoint
    let register = warp::path("api")
        .and(warp::path("register"))
        .and(warp::post())
        .and(warp::body::json())
        .and(client_registry_filter)
        .and_then(handle_client_registration);

    // Combine routes with proper error handling
    let routes = health
        .or(api_sensor_data)
        .or(register)
        .recover(handle_rejection)
        .with(warp::cors().allow_any_origin());

    // Start the server in a background task
    let handle = tokio::spawn(async move {
        warp::serve(routes)
            .run(([0, 0, 0, 0], port))
            .await;
    });

    Ok(handle)
}

async fn load_existing_clients_into_registry(client_registry: &ClientRegistry) {
    info!("Loading existing clients into registry");
    let config = crate::config::read_from_app_config();
    let mut registry = client_registry.write().await;
    
    for (mac_address, legacy_client) in config.registered_clients {
        let normalized_mac = normalize_mac_address(&mac_address);
        let client = RegisteredClient {
            mac_address: normalized_mac.clone(),
            name: legacy_client.name,
            ip_address: legacy_client.ip_address,
            resolution_width: legacy_client.resolution_width,
            resolution_height: legacy_client.resolution_height,
            active: legacy_client.active,
            last_seen: legacy_client.last_seen.timestamp() as u64,
            registered_at: legacy_client.last_seen.timestamp() as u64, // Fallback
            display_config: legacy_client.display_config,
        };
        registry.insert(normalized_mac, client);
    }
    
    info!("Loaded {} existing clients into registry", registry.len());
}

async fn handle_sensor_data_request(
    params: HashMap<String, String>,
    client_registry: ClientRegistry,
    sensor_values: Arc<Vec<sensor_core::SensorValue>>,
    sensor_history: Arc<Mutex<Vec<Vec<sensor_core::SensorValue>>>>,
) -> Result<impl warp::Reply, warp::Rejection> {
    // Extract and validate MAC address parameter
    let mac_address = params
        .get("mac_address")
        .ok_or_else(|| warp::reject::custom(ApiError::BadRequest("mac_address parameter required".to_string())))?
        .to_string();

    // Normalize MAC address format
    let normalized_mac = normalize_mac_address(&mac_address);

    let mut clients = client_registry.write().await;
    
    match clients.get_mut(&normalized_mac) {
        None => {
            // Client not registered - return 404
            info!("Client {} not registered", mac_address);
            Err(warp::reject::custom(ApiError::NotRegistered))
        }
        Some(client) if !client.active => {
            // Client registered but not active - return 403
            info!("Client {} not active", mac_address);
            client.update_last_seen();
            Err(warp::reject::custom(ApiError::NotActive))
        }
        Some(client) => {
            // Client is registered and active - update last seen and return data
            info!("Serving sensor data to client {}", mac_address);
            client.update_last_seen();

            // Create client-specific render data
            let render_data = create_render_data_for_client(
                client,
                &sensor_values,
                &sensor_history,
            );

            let response = serde_json::json!({
                "render_data": render_data,
                "timestamp": Utc::now().timestamp()
            });

            Ok(warp::reply::json(&response))
        }
    }
}

async fn handle_client_registration(
    registration: serde_json::Value,
    client_registry: ClientRegistry,
) -> Result<impl warp::Reply, warp::Rejection> {
    info!("Client registration request: {:?}", registration);

    // Extract and validate registration data
    let mac_address = registration["mac_address"]
        .as_str()
        .ok_or_else(|| warp::reject::custom(ApiError::BadRequest("mac_address is required".to_string())))?;
    
    let ip_address = registration["ip_address"]
        .as_str()
        .ok_or_else(|| warp::reject::custom(ApiError::BadRequest("ip_address is required".to_string())))?;
    
    let width = registration["resolution_width"]
        .as_u64()
        .unwrap_or(1920) as u32;
    
    let height = registration["resolution_height"]
        .as_u64()
        .unwrap_or(1080) as u32;
    
    let custom_name = registration["name"].as_str();

    // Normalize MAC address
    let normalized_mac = normalize_mac_address(mac_address);
    
    // Generate client name
    let client_name = if let Some(name) = custom_name {
        name.to_string()
    } else {
        format!("Display {}", &normalized_mac[..8])
    };

    let mut clients = client_registry.write().await;
    
    // Check if client already exists
    let client = if let Some(existing_client) = clients.get_mut(&normalized_mac) {
        // Update existing client
        existing_client.ip_address = ip_address.to_string();
        existing_client.resolution_width = width;
        existing_client.resolution_height = height;
        existing_client.name = client_name;
        existing_client.update_last_seen();
        
        info!("Updated existing client: {}", normalized_mac);
        existing_client.clone()
    } else {
        // Create new client
        let new_client = RegisteredClient::new(
            normalized_mac.clone(),
            client_name,
            ip_address.to_string(),
            width,
            height,
        );
        
        clients.insert(normalized_mac.clone(), new_client.clone());
        info!("Registered new client: {}", normalized_mac);
        new_client
    };

    // Also sync with existing config system for persistence
    let _legacy_client = crate::config::register_client(
        normalized_mac,
        ip_address.to_string(),
        width,
        height,
    );

    let response = serde_json::json!({
        "success": true,
        "message": "Client registered successfully",
        "client": client
    });

    Ok(warp::reply::json(&response))
}

fn create_render_data_for_client(
    client: &RegisteredClient,
    sensor_values: &Arc<Vec<sensor_core::SensorValue>>,
    sensor_history: &Arc<Mutex<Vec<Vec<sensor_core::SensorValue>>>>,
) -> serde_json::Value {
    // Use the existing sensor reading logic but with client-specific display config
    let current_sensor_values = crate::sensor::read_all_sensor_values(
        sensor_history,
        sensor_values,
    );

    serde_json::json!({
        "display_config": client.display_config,
        "sensor_values": current_sensor_values
    })
}

fn normalize_mac_address(mac: &str) -> String {
    // Normalize MAC address format: convert to lowercase and use : as separator
    mac.to_lowercase()
        .chars()
        .filter(|c| c.is_ascii_hexdigit())
        .collect::<Vec<_>>()
        .chunks(2)
        .map(|chunk| chunk.iter().collect::<String>())
        .collect::<Vec<_>>()
        .join(":")
}

async fn handle_rejection(err: warp::Rejection) -> Result<impl warp::Reply, std::convert::Infallible> {
    let (code, message) = if let Some(api_error) = err.find::<ApiError>() {
        match api_error {
            ApiError::NotRegistered => {
                (warp::http::StatusCode::NOT_FOUND, "Client not registered")
            }
            ApiError::NotActive => {
                (warp::http::StatusCode::FORBIDDEN, "Client not active")
            }
            ApiError::BadRequest(msg) => {
                (warp::http::StatusCode::BAD_REQUEST, msg.as_str())
            }
            ApiError::InternalError(msg) => {
                (warp::http::StatusCode::INTERNAL_SERVER_ERROR, msg.as_str())
            }
        }
    } else if err.is_not_found() {
        (warp::http::StatusCode::NOT_FOUND, "Endpoint not found")
    } else if let Some(_) = err.find::<warp::filters::body::BodyDeserializeError>() {
        (warp::http::StatusCode::BAD_REQUEST, "Invalid JSON body")
    } else {
        (warp::http::StatusCode::INTERNAL_SERVER_ERROR, "Internal server error")
    };

    let json = warp::reply::json(&serde_json::json!({
        "error": message,
        "status": code.as_u16()
    }));

    Ok(warp::reply::with_status(json, code))
}