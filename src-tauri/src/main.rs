#![cfg_attr(
all(not(debug_assertions), target_os = "windows"),
windows_subsystem = "windows"
)]

use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread;

use tauri::State;

use crate::config::{ComPortConfig, OutputConfig};

mod aida64;
mod serial_port;
mod config;

pub struct AppState {
    pub port_handle: Mutex<HashMap<String, ThreadHandle>>,
}

pub struct ThreadHandle {
    pub running: Arc<Mutex<bool>>,
    pub handle: Arc<thread::JoinHandle<()>>,
}


#[tauri::command]
fn get_com_ports() -> Vec<String> {
    serial_port::list_ports().iter().map(|x| x.port_name.clone()).collect()
}

#[tauri::command]
fn get_sensor_values() -> String {
    let sensor_values = aida64::read_sensors();
    serde_json::to_string(&sensor_values).unwrap()
}

#[tauri::command]
fn load_port_config(com_port: String) -> String {
    let port_config: ComPortConfig = config::load_port_config(&com_port);
    serde_json::to_string(&port_config).unwrap()
}

#[tauri::command]
fn add_output_address(com_port: String, address: String) {
    let mut port_config: ComPortConfig = config::load_port_config(&com_port);
    port_config.output_config.insert(address.clone(), OutputConfig::default(&address));
    config::write_port_config(&port_config);
}

#[tauri::command]
fn delete_output_address(com_port: String, address: String) {
    let mut port_config: ComPortConfig = config::load_port_config(&com_port);
    port_config.output_config.remove(&address);
    config::write_port_config(&port_config);
}

/// Returns the address config for the specified address and port.
#[tauri::command]
fn load_address_config(com_port: String, output_address: String) -> String {
    let port_config: ComPortConfig = config::load_port_config(&com_port);
    port_config.output_config.get(&output_address).unwrap().data_config.clone()
}

/// Saves the address config for the specified address and port.
/// If the address config does not exist, it will be created.
#[tauri::command]
fn save_address_config(com_port: String, output_address: String, data_config: String) {
    let mut port_config: ComPortConfig = config::load_port_config(&com_port);
    port_config.output_config.get_mut(&output_address).unwrap().data_config = data_config;
    config::write_port_config(&port_config);
}

/// Enables the sync for the specified address and port.
/// Also set the config for the port to active and save it
#[tauri::command]
fn enable_sync(app_state: State<AppState>, com_port: String) {
    let mut port_config: ComPortConfig = config::load_port_config(&com_port);
    port_config.active = true;
    config::write_port_config(&port_config);

    // Check if the port is already active
    // If so, interrupt the thread
    //

    // Start the sync for the port and handover the running state
    let port_running_state_handle = Arc::new(Mutex::new(true));
    let port_handle = serial_port::start_sync(port_config, port_running_state_handle.clone());
    let thread_handle = ThreadHandle {
        running: port_running_state_handle,
        handle: port_handle,
    };
    app_state.port_handle.lock().unwrap().insert(com_port, thread_handle);
}

fn stop_comport_sync_thread(com_port: &str, port_handle: MutexGuard<HashMap<String, ThreadHandle>>) {
    // If the port handle is not in the map, return
    if !port_handle.contains_key(com_port) {
        return;
    }

    let port_thread_handle = port_handle.get(com_port).unwrap();
    *port_thread_handle.running.lock().unwrap() = false;
    port_thread_handle.handle.thread().unpark();
}

/// Disables the sync for the specified address and port.
/// Also set the config for the port to inactive and save it
#[tauri::command]
fn disable_sync(app_state: State<AppState>, com_port: String) {
    let mut port_config: ComPortConfig = config::load_port_config(&com_port);
    port_config.active = false;
    config::write_port_config(&port_config);

    // Stop the sync thread for the port
    let port_handle = app_state.port_handle.lock().unwrap();
    stop_comport_sync_thread(&com_port, port_handle);
}

fn main() {
    // TODO: Load the config for all ports and if they are active,
    // start the sync for the corresponding port
    let port_handle = HashMap::new();

    tauri::Builder::default()
        .manage(AppState {
            port_handle: Mutex::new(port_handle),
        })
        .invoke_handler(tauri::generate_handler![
            get_com_ports,
            get_sensor_values,
            load_port_config,
            add_output_address,
            delete_output_address,
            load_address_config,
            save_address_config,
            enable_sync,
            disable_sync,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
