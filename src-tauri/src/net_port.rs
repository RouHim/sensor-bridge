use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use log::{debug, error, info, warn};
use sensor_core::{DisplayConfig, RenderData, SensorValue, TransportMessage, TransportType};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use warp::Filter;

use crate::config::NetworkDeviceConfig;
use crate::{conditional_image, sensor, static_image, text};

const PUSH_RATE: Duration = Duration::from_millis(1000);
const NETWORK_PORT: u16 = 10489;

// Structure to hold client information
#[derive(Debug, Clone)]
pub struct ClientInfo {
    pub id: String,
    pub name: String,
    pub display_config: DisplayConfig,
    pub last_seen: Instant,
}

// Structure for client registration
#[derive(Debug, Deserialize, Serialize)]
pub struct ClientRegistration {
    pub name: String,
    pub display_config: DisplayConfig,
}

// HTTP server state
pub struct HttpServer {
    clients: Arc<Mutex<HashMap<String, ClientInfo>>>,
    data_sender: broadcast::Sender<Vec<u8>>,
    static_data_cache: Arc<Mutex<HashMap<String, Vec<u8>>>>, // Cache for static data by type
}

impl HttpServer {
    pub fn new() -> Self {
        let (data_sender, _) = broadcast::channel(100);
        Self {
            clients: Arc::new(Mutex::new(HashMap::new())),
            data_sender,
            static_data_cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

/// Starts the HTTP server that clients will connect to
pub async fn start_server(
    sensor_value_history: Arc<Mutex<Vec<Vec<SensorValue>>>>,
    static_sensor_values: Arc<Vec<SensorValue>>,
    net_port_configs: Vec<NetworkDeviceConfig>,
    server_running_state: Arc<Mutex<bool>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let server = Arc::new(HttpServer::new());

    // Prepare static data for all configured devices
    prepare_all_static_data(&net_port_configs, &server).await;

    // Start data broadcasting task
    let broadcast_server = server.clone();
    let broadcast_sensor_history = sensor_value_history.clone();
    let broadcast_static_values = static_sensor_values.clone();
    let broadcast_configs = net_port_configs.clone();
    let broadcast_running_state = server_running_state.clone();

    tokio::spawn(async move {
        broadcast_data_loop(
            broadcast_sensor_history,
            broadcast_static_values,
            broadcast_configs,
            broadcast_server,
            broadcast_running_state,
        )
        .await;
    });

    // Routes
    let clients = server.clients.clone();
    let ping_route = warp::path("ping").and(warp::get()).map(|| "pong");

    let register_route = warp::path("register")
        .and(warp::post())
        .and(warp::body::json())
        .and(with_clients(clients.clone()))
        .and_then(register_client);

    let data_route = warp::path("data")
        .and(warp::get())
        .and(warp::query::<HashMap<String, String>>())
        .and(with_server(server.clone()))
        .and_then(get_data_stream);

    let static_data_route = warp::path!("static" / String)
        .and(warp::get())
        .and(with_server(server.clone()))
        .and_then(get_static_data);

    let routes = ping_route
        .or(register_route)
        .or(data_route)
        .or(static_data_route)
        .with(warp::cors().allow_any_origin())
        .with(warp::log("sensor_bridge"));

    let addr: SocketAddr = format!("0.0.0.0:{}", NETWORK_PORT).parse()?;
    info!("Starting HTTP server on {}", addr);

    warp::serve(routes).run(addr).await;
    Ok(())
}

// Helper functions for warp filters
fn with_clients(
    clients: Arc<Mutex<HashMap<String, ClientInfo>>>,
) -> impl Filter<
    Extract = (Arc<Mutex<HashMap<String, ClientInfo>>>,),
    Error = std::convert::Infallible,
> + Clone {
    warp::any().map(move || clients.clone())
}

fn with_server(
    server: Arc<HttpServer>,
) -> impl Filter<Extract = (Arc<HttpServer>,), Error = std::convert::Infallible> + Clone {
    warp::any().map(move || server.clone())
}

// Handler for client registration
async fn register_client(
    registration: ClientRegistration,
    clients: Arc<Mutex<HashMap<String, ClientInfo>>>,
) -> Result<impl warp::Reply, warp::Rejection> {
    let client_id = uuid::Uuid::new_v4().to_string();
    let client_info = ClientInfo {
        id: client_id.clone(),
        name: registration.name.clone(),
        display_config: registration.display_config,
        last_seen: Instant::now(),
    };

    {
        let mut clients_guard = clients.lock().unwrap();
        clients_guard.insert(client_id.clone(), client_info);
    }

    info!(
        "Client '{}' registered with ID: {}",
        registration.name, client_id
    );

    Ok(warp::reply::json(&serde_json::json!({
        "client_id": client_id,
        "status": "registered"
    })))
}

// Handler for data streaming
async fn get_data_stream(
    params: HashMap<String, String>,
    server: Arc<HttpServer>,
) -> Result<impl warp::Reply, warp::Rejection> {
    let client_id = params
        .get("client_id")
        .ok_or_else(|| warp::reject::custom(ClientError::MissingClientId))?;

    // Update client last_seen time
    {
        let mut clients = server.clients.lock().unwrap();
        if let Some(client) = clients.get_mut(client_id) {
            client.last_seen = Instant::now();
        } else {
            return Err(warp::reject::custom(ClientError::UnknownClient));
        }
    }

    let mut receiver = server.data_sender.subscribe();

    match receiver.recv().await {
        Ok(data) => Ok(warp::reply::with_header(
            data,
            "Content-Type",
            "application/octet-stream",
        )),
        Err(_) => Err(warp::reject::custom(ClientError::DataReceiveError)),
    }
}

// Handler for static data
async fn get_static_data(
    data_type: String,
    server: Arc<HttpServer>,
) -> Result<impl warp::Reply, warp::Rejection> {
    let cache = server.static_data_cache.lock().unwrap();

    if let Some(data) = cache.get(&data_type) {
        Ok(warp::reply::with_header(
            data.clone(),
            "Content-Type",
            "application/octet-stream",
        ))
    } else {
        Err(warp::reject::custom(ClientError::StaticDataNotFound))
    }
}

// Custom error types for warp rejection
#[derive(Debug)]
enum ClientError {
    MissingClientId,
    UnknownClient,
    DataReceiveError,
    StaticDataNotFound,
}

impl warp::reject::Reject for ClientError {}

/// Prepares static data for all configured network devices
async fn prepare_all_static_data(
    net_port_configs: &[NetworkDeviceConfig],
    server: &Arc<HttpServer>,
) {
    let mut cache = server.static_data_cache.lock().unwrap();

    for config in net_port_configs {
        // Prepare text data
        let text_data = text::get_preparation_data(&config.display_config);
        let serialized_text = text::serialize(text_data);
        cache.insert(format!("text_{}", config.name), serialized_text);

        // Prepare static image data
        let static_image_data = static_image::get_preparation_data(&config.display_config);
        let serialized_static_image = static_image::serialize(static_image_data);
        cache.insert(
            format!("static_image_{}", config.name),
            serialized_static_image,
        );

        // Prepare conditional image data
        let conditional_image_data =
            conditional_image::get_preparation_data(&config.display_config);
        let serialized_conditional_image =
            conditional_image::serialize_preparation_data(conditional_image_data);
        cache.insert(
            format!("conditional_image_{}", config.name),
            serialized_conditional_image,
        );
    }

    info!(
        "Static data prepared for {} devices",
        net_port_configs.len()
    );
}

/// Main data broadcasting loop
async fn broadcast_data_loop(
    sensor_value_history: Arc<Mutex<Vec<Vec<SensorValue>>>>,
    static_sensor_values: Arc<Vec<SensorValue>>,
    net_port_configs: Vec<NetworkDeviceConfig>,
    server: Arc<HttpServer>,
    server_running_state: Arc<Mutex<bool>>,
) {
    while *server_running_state.lock().unwrap() {
        let start_time = Instant::now();

        // Read sensor values
        let last_sensor_values =
            sensor::read_all_sensor_values(&sensor_value_history, &static_sensor_values);

        // Clean up old clients (haven't been seen in 30 seconds)
        cleanup_old_clients(&server.clients);

        // For each active client, send appropriate data
        let active_clients = {
            let clients = server.clients.lock().unwrap();
            clients.clone()
        };

        for (_client_id, client_info) in active_clients {
            // Find the matching config for this client
            if let Some(config) = net_port_configs.iter().find(|c| c.name == client_info.name) {
                let data_to_send = serialize_render_data(
                    config.display_config.clone(),
                    last_sensor_values.clone(),
                );

                // Send data via broadcast channel
                if let Err(e) = server.data_sender.send(data_to_send) {
                    warn!("Failed to broadcast data: {:?}", e);
                }
            }
        }

        // Log active clients count
        let client_count = server.clients.lock().unwrap().len();
        if client_count > 0 {
            debug!("Broadcasting data to {} active clients", client_count);
        }

        // Wait for the next iteration
        wait_for_next_iteration(start_time).await;
    }
}

/// Removes clients that haven't been seen for more than 30 seconds
fn cleanup_old_clients(clients: &Arc<Mutex<HashMap<String, ClientInfo>>>) {
    let mut clients_guard = clients.lock().unwrap();
    let now = Instant::now();
    let timeout = Duration::from_secs(30);

    let old_clients: Vec<String> = clients_guard
        .iter()
        .filter(|(_, client)| now.duration_since(client.last_seen) > timeout)
        .map(|(id, _)| id.clone())
        .collect();

    for client_id in old_clients {
        if let Some(client) = clients_guard.remove(&client_id) {
            info!("Removed inactive client: {} ({})", client.name, client_id);
        }
    }
}

/// Serializes the sensor values and display config to a transport message
fn serialize_render_data(
    display_config: DisplayConfig,
    last_sensor_values: Vec<SensorValue>,
) -> Vec<u8> {
    let render_data = RenderData {
        display_config,
        sensor_values: last_sensor_values,
    };
    let render_data = bincode::serialize(&render_data).unwrap();

    let transport_message = TransportMessage {
        transport_type: TransportType::RenderImage,
        data: render_data,
    };

    bincode::serialize(&transport_message).unwrap()
}

/// Waits for the remaining time of the update interval
async fn wait_for_next_iteration(start_time: Instant) {
    let processing_duration = Instant::now().duration_since(start_time);
    debug!("Processing duration: {:?}", processing_duration);

    let time_to_wait = PUSH_RATE
        .checked_sub(processing_duration)
        .unwrap_or_else(|| {
            warn!("Warning: Processing duration is longer than the update interval");
            PUSH_RATE
        });

    tokio::time::sleep(time_to_wait).await;
}

/// Legacy function to maintain compatibility - starts the server in a blocking way
pub fn start_sync(
    sensor_value_history: &Arc<Mutex<Vec<Vec<SensorValue>>>>,
    static_sensor_values: &Arc<Vec<SensorValue>>,
    net_port_config: NetworkDeviceConfig,
    port_running_state_handle: Arc<Mutex<bool>>,
) -> Arc<thread::JoinHandle<()>> {
    let sensor_value_history = sensor_value_history.clone();
    let static_sensor_values = static_sensor_values.clone();
    let configs = vec![net_port_config];

    let handle = thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            if let Err(e) = start_server(
                sensor_value_history,
                static_sensor_values,
                configs,
                port_running_state_handle,
            )
            .await
            {
                error!("Server error: {:?}", e);
            }
        });
    });

    Arc::new(handle)
}

/// Verifies that the server can bind to the network port
pub fn verify_network_address(_address: &str) -> bool {
    // For server mode, we just check if we can bind to the port
    check_server_port()
}

/// Tests if we can bind to the server port
pub fn check_server_port() -> bool {
    match std::net::TcpListener::bind(format!("0.0.0.0:{}", NETWORK_PORT)) {
        Ok(_) => {
            info!("Server port {} is available", NETWORK_PORT);
            true
        }
        Err(err) => {
            error!("Cannot bind to server port {}: {:?}", NETWORK_PORT, err);
            false
        }
    }
}
