#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::collections::HashMap;

use std::sync::{Arc, Mutex, MutexGuard};
use std::thread;

use crate::config::{AppConfig, NetPortConfig};
use tauri::State;
use tauri::{AppHandle, GlobalWindowEvent, Manager, Wry};
use tauri::{CustomMenuItem, SystemTray, SystemTrayEvent, SystemTrayMenu};

mod config;
mod lcd_preview;
mod linux_lm_sensors;
mod linux_mangohud;
mod misc_sensor;
mod net_port;
mod sensor;
mod system_stat_sensor;

pub struct AppState {
    pub port_handle: Mutex<HashMap<String, ThreadHandle>>,
}

pub struct ThreadHandle {
    pub running: Arc<Mutex<bool>>,
    pub handle: Arc<thread::JoinHandle<()>>,
}

/// Name of the default window
const WINDOW_NAME: &str = "main";

fn main() {
    // Create the port handle map wrapped in a mutex
    let app_state_network_handles = Mutex::new(HashMap::new());

    // Load the config for all ports
    // If the port is active, start a sync thread
    // And report the handle to the app state
    config::read_from_app_config()
        .network_devices
        .values()
        .filter(|net_config| net_config.active)
        .for_each(|net_config| {
            let thread_handle = start_port_thread(net_config.clone());
            app_state_network_handles
                .lock()
                .unwrap()
                .insert(net_config.id.clone(), thread_handle);
        });

    // Create the tray icon
    tauri::Builder::default()
        .system_tray(build_system_tray())
        .on_system_tray_event(build_system_tray_handler())
        .manage(AppState {
            port_handle: app_state_network_handles,
        })
        .invoke_handler(tauri::generate_handler![
            get_sensor_values,
            get_app_config,
            create_network_device_config,
            get_network_device_config,
            remove_network_device_config,
            save_app_config,
            enable_sync,
            disable_sync,
            toggle_lcd_live_preview,
            get_lcd_preview_image,
        ])
        .on_window_event(handle_window_events())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn get_sensor_values() -> String {
    let sensor_values = sensor::read_all_sensor_values();
    serde_json::to_string(&sensor_values).unwrap()
}

#[tauri::command]
fn create_network_device_config() -> String {
    let port_config: NetPortConfig = config::create();
    port_config.id
}

#[tauri::command]
fn get_network_device_config(network_device_id: String) -> String {
    let port_config: NetPortConfig = config::read(&network_device_id);
    serde_json::to_string(&port_config).unwrap()
}

#[tauri::command]
fn get_app_config() -> String {
    let app_config: AppConfig = config::read_from_app_config();
    serde_json::to_string(&app_config).unwrap()
}

#[tauri::command]
fn remove_network_device_config(network_device_id: String) {
    config::remove(&network_device_id);
}

/// Saves the address config for the specified address and port.
/// If the address config does not exist, it will be created.
#[tauri::command]
fn save_app_config(id: String, name: String, address: String, lcd_config: String) {
    let mut port_config: NetPortConfig = config::read(&id);

    port_config.name = name;
    port_config.address = address;
    port_config.lcd_config = serde_json::from_str(lcd_config.as_str()).unwrap();

    config::write(&port_config);
}

/// Enables the sync for the specified address and port.
/// Also set the config for the port to active and save it
#[tauri::command]
fn enable_sync(app_state: State<AppState>, network_device_id: String) {
    let mut port_config: NetPortConfig = config::read(&network_device_id);
    port_config.active = true;
    config::write(&port_config);

    // Start the sync for the port and hand
    // This creates a new thread and returns a handle to it
    let thread_handle = start_port_thread(port_config);

    // Add the port handle to the app state
    app_state
        .port_handle
        .lock()
        .unwrap()
        .insert(network_device_id, thread_handle);
}

/// Starts the sync thread for the specified port
/// Returns a handle to the thread
fn start_port_thread(port_config: NetPortConfig) -> ThreadHandle {
    let port_running_state_handle = Arc::new(Mutex::new(true));
    let port_handle = net_port::start_sync(port_config, port_running_state_handle.clone());

    ThreadHandle {
        running: port_running_state_handle,
        handle: port_handle,
    }
}

/// Stops the sync thread for the specified port
/// This will also remove the port from the app state
fn stop_sync_thread(
    network_device_id: &str,
    port_handle: MutexGuard<HashMap<String, ThreadHandle>>,
) {
    // If the port handle is not in the map, return
    if !port_handle.contains_key(network_device_id) {
        return;
    }

    let port_thread_handle = port_handle.get(network_device_id).unwrap();
    *port_thread_handle.running.lock().unwrap() = false;
    port_thread_handle.handle.thread().unpark();
}

/// Disables the sync for the specified address and port.
/// Also set the config for the port to inactive and save it
#[tauri::command]
fn disable_sync(app_state: State<AppState>, network_device_id: String) {
    let mut port_config: NetPortConfig = config::read(&network_device_id);
    port_config.active = false;
    config::write(&port_config);

    // Stop the sync thread for the port
    let port_handle = app_state.port_handle.lock().unwrap();
    stop_sync_thread(&network_device_id, port_handle);
}

/// Toggles the live preview for the specified lcd address and port.
/// If the live preview is enabled, it will be disabled and vice versa.
//noinspection RsWrongGenericArgumentsNumber
#[tauri::command]
fn toggle_lcd_live_preview(app_handle: AppHandle, network_device_id: String) {
    let port_config: NetPortConfig = config::read(&network_device_id);

    let maybe_window = app_handle.get_window(lcd_preview::WINDOW_LABEL);

    if let Some(window) = maybe_window {
        // If the window is visible, hide it and stop the sync thread
        if window.is_visible().unwrap() {
            window.close().unwrap();
        } else {
            window.show().unwrap();
        }
    } else {
        lcd_preview::open(app_handle, &port_config);
    };
}

/// Returns the lcd preview image for the specified com port as base64 encoded string
//noinspection RsWrongGenericArgumentsNumber
#[tauri::command]
fn get_lcd_preview_image(app_handle: AppHandle, network_device_id: String) -> String {
    let port_config: NetPortConfig = config::read(&network_device_id);
    let lcd_config = port_config.lcd_config;

    // If the window is not visible, return an empty string
    let maybe_window = app_handle.get_window(lcd_preview::WINDOW_LABEL);
    if let Some(window) = maybe_window {
        if !window.is_visible().unwrap() {
            return String::new();
        }
    }

    lcd_preview::render(lcd_config)
}

/// Handle tauri window events
fn handle_window_events() -> fn(GlobalWindowEvent<Wry>) {
    |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event.event() {
            event.window().hide().unwrap();
            api.prevent_close();
        }
    }
}

/// Build the system tray handler
fn build_system_tray_handler() -> fn(&AppHandle<Wry>, SystemTrayEvent) {
    |app, event| match event {
        SystemTrayEvent::DoubleClick {
            position: _,
            size: _,
            ..
        } => {
            let window = app.get_window(WINDOW_NAME).unwrap();
            if window.is_visible().unwrap() {
                window.hide().unwrap();
            } else {
                window.show().unwrap();
            }
        }
        SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
            "quit" => {
                app.exit(0);
            }
            "show" => {
                app.get_window("main").unwrap().show().unwrap();
            }
            _ => {}
        },
        _ => {}
    }
}

/// Build the system tray
fn build_system_tray() -> SystemTray {
    SystemTray::new().with_menu(
        SystemTrayMenu::new()
            .add_item(CustomMenuItem::new("show".to_string(), "Show"))
            .add_item(CustomMenuItem::new("quit".to_string(), "Quit")),
    )
}
