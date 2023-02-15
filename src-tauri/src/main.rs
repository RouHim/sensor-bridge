#![cfg_attr(

all(not(debug_assertions), target_os = "windows"),
windows_subsystem = "windows"
)]

use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread;

use tauri::{AppHandle, GlobalWindowEvent, Manager, Wry};
use tauri::{CustomMenuItem, SystemTray, SystemTrayEvent, SystemTrayMenu};
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

/// Name of the default window
const WINDOW_NAME: &str = "main";

#[tauri::command]
fn get_com_ports() -> Vec<String> {
    let mut ports: Vec<String> = serial_port::list_ports()
        .iter()
        .map(|x| x.port_name.clone())
        .collect();
    ports.sort_unstable();
    ports
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
    let output_config = port_config.output_config.get(&output_address).unwrap();
    serde_json::to_string(&output_config).unwrap()
}

/// Saves the address config for the specified address and port.
/// If the address config does not exist, it will be created.
#[tauri::command]
fn save_config(com_port: String, output_address: String, data_config: String, font_size: u8, baud_rate: String, push_rate: String) {
    let mut port_config: ComPortConfig = config::load_port_config(&com_port);
    port_config.baud_rate = baud_rate.parse().unwrap();
    port_config.push_rate = push_rate.parse().unwrap();
    port_config.output_config.get_mut(&output_address).unwrap().data_config = data_config;
    port_config.output_config.get_mut(&output_address).unwrap().font_size = font_size;
    config::write_port_config(&port_config);
}

/// Enables the sync for the specified address and port.
/// Also set the config for the port to active and save it
#[tauri::command]
fn enable_sync(app_state: State<AppState>, com_port: String) {
    let mut port_config: ComPortConfig = config::load_port_config(&com_port);
    port_config.active = true;
    config::write_port_config(&port_config);

    // Start the sync for the port and hand
    // This creates a new thread and returns a handle to it
    let thread_handle = start_port_thread(port_config);

    // Add the port handle to the app state
    app_state.port_handle.lock().unwrap().insert(com_port, thread_handle);
}

/// Starts the sync thread for the specified port
/// Returns a handle to the thread
fn start_port_thread(port_config: ComPortConfig) -> ThreadHandle {
    let port_running_state_handle = Arc::new(Mutex::new(true));
    let port_handle = serial_port::start_sync(port_config, port_running_state_handle.clone());

    ThreadHandle {
        running: port_running_state_handle,
        handle: port_handle,
    }
}

/// Stops the sync thread for the specified port
/// This will also remove the port from the app state
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
    // Create the port handle map wrapped in a mutex
    let app_state_port_handles = Mutex::new(HashMap::new());

    // Load the config for all ports
    // If the port is active, start a sync thread
    // And report the handle to the app state
    get_com_ports().iter()
        .map(|port| config::load_port_config(port))
        .filter(|port_config| port_config.active)
        .for_each(|port_config| {
            let thread_handle = start_port_thread(port_config.clone());
            app_state_port_handles.lock().unwrap().insert(port_config.com_port, thread_handle);
        });

    // Create the tray icon
    tauri::Builder::default()
        .system_tray(build_system_tray())
        .on_system_tray_event(build_system_tray_handler())
        .manage(AppState {
            port_handle: app_state_port_handles,
        })
        .invoke_handler(tauri::generate_handler![
            get_com_ports,
            get_sensor_values,
            load_port_config,
            add_output_address,
            delete_output_address,
            load_address_config,
            save_config,
            enable_sync,
            disable_sync,
        ])
        .on_window_event(handle_window_events())
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}

/// Handle tauri window  events
fn handle_window_events() -> fn(GlobalWindowEvent<Wry>) {
    |event|
        if let tauri::WindowEvent::CloseRequested { api, .. } = event.event() {
            event.window().hide().unwrap();
            api.prevent_close();
        }
}

/// Build the system tray handler
fn build_system_tray_handler() -> fn(&AppHandle<Wry>, SystemTrayEvent) {
    |app, event| {
        match event {
            SystemTrayEvent::DoubleClick { position: _, size: _, .. } => {
                let window = app.get_window(WINDOW_NAME).unwrap();
                if window.is_visible().unwrap() {
                    window.hide().unwrap();
                } else {
                    window.show().unwrap();
                }
            }
            SystemTrayEvent::MenuItemClick { id, .. } => {
                match id.as_str() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        app.get_window("main").unwrap().show().unwrap();
                    }
                    _ => {}
                }
            }
            _ => {}
        }
    }
}

/// Build the system tray
fn build_system_tray() -> SystemTray {
    SystemTray::new()
        .with_menu(SystemTrayMenu::new()
            .add_item(CustomMenuItem::new("show".to_string(), "Show"))
            .add_item(CustomMenuItem::new("quit".to_string(), "Quit"))
        )
}
