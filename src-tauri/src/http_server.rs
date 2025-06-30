use std::sync::{Arc, Mutex};
use tokio::task::JoinHandle;
use warp::Filter;
use log::info;
use serde_json;

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

    // Create a simple health check endpoint
    let health = warp::path("health")
        .and(warp::get())
        .map(|| {
            warp::reply::json(&serde_json::json!({
                "status": "ok",
                "service": "sensor-bridge",
                "timestamp": chrono::Utc::now()
            }))
        });

    // Clone the Arc references for use in the closure
    let sensor_values_clone = sensor_values.clone();
    let sensor_history_clone = sensor_value_history.clone();

    // Create an API endpoint to get sensor data
    let api_sensors = warp::path("api")
        .and(warp::path("sensors"))
        .and(warp::get())
        .map(move || {
            let sensor_values = crate::sensor::read_all_sensor_values(
                &sensor_history_clone,
                &sensor_values_clone,
            );

            warp::reply::json(&serde_json::json!({
                "sensors": sensor_values,
                "timestamp": chrono::Utc::now()
            }))
        });

    // Client registration endpoint
    let register = warp::path("api")
        .and(warp::path("register"))
        .and(warp::post())
        .and(warp::body::json())
        .map(|registration: serde_json::Value| {
            info!("Client registration request: {:?}", registration);

            // Extract registration data
            let mac_address = registration["mac_address"].as_str().unwrap_or("unknown");
            let ip_address = registration["ip_address"].as_str().unwrap_or("unknown");
            let width = registration["resolution_width"].as_u64().unwrap_or(320) as u32;
            let height = registration["resolution_height"].as_u64().unwrap_or(240) as u32;

            // Register the client
            let client = crate::config::register_client(
                mac_address.to_string(),
                ip_address.to_string(),
                width,
                height,
            );

            warp::reply::json(&serde_json::json!({
                "success": true,
                "message": "Client registered successfully",
                "client": client
            }))
        });

    // Combine routes
    let routes = health
        .or(api_sensors)
        .or(register)
        .with(warp::cors().allow_any_origin());

    // Start the server in a background task
    let handle = tokio::spawn(async move {
        warp::serve(routes)
            .run(([0, 0, 0, 0], port))
            .await;
    });

    Ok(handle)
}

pub fn stop_server(handle: JoinHandle<()>) {
    info!("Stopping HTTP server");
    handle.abort();
}
