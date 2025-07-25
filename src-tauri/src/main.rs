#![cfg_attr(not(debug_assertions), deny(warnings))]

use crate::config::{AppConfig, NetworkDeviceConfig};
use crate::utils::LockResultExt;
use log::error;
use sensor_core::{
    conditional_image_renderer, graph_renderer, ConditionalImageConfig, ElementType, GraphConfig,
    SensorType, SensorValue, TextConfig,
};
use std::collections::HashMap;
use std::error::Error;
use std::ops::Deref;
use std::sync::{Arc, Mutex, MutexGuard};
use std::{fs, thread};
use super_shell::RootShell;
use tauri::menu::{Menu, MenuItem};
use tauri::{
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    App, State,
};
use tauri::{AppHandle, Manager};

mod conditional_image;
pub(crate) mod config;
mod export_import;
mod fonts;
mod lcd_preview;
mod linux_dmidecode_sensors;
mod linux_lm_sensors;
mod linux_system_sensors;
mod misc_sensor;
mod net_port;
mod sensor;
mod static_image;
mod system_stat_sensor;
mod text;
mod utils;

#[cfg(test)]
mod fonts_test;
mod linux_amdgpu;

pub struct AppState {
    pub port_handle: Mutex<HashMap<String, ThreadHandle>>,
    pub root_shell: Arc<Mutex<Option<RootShell>>>,
    pub static_sensor_values: Arc<Vec<SensorValue>>,
    pub sensor_value_history: Arc<Mutex<Vec<Vec<SensorValue>>>>,
}

pub struct ThreadHandle {
    pub running: Arc<Mutex<bool>>,
    pub handle: Arc<thread::JoinHandle<()>>,
}

// Number of elements to be stored in the sensor value history
pub const SENSOR_VALUE_HISTORY_SIZE: usize = 1000;

fn main() {
    // Set the app name for the dynamic cache folder detection
    // TODO: fixme
    unsafe {
        std::env::set_var("SENSOR_BRIDGE_APP_NAME", "sensor-bridge");
    }

    // Initialize the logger
    env_logger::init();

    // Cleanup cache dir
    fs::remove_dir_all(sensor_core::get_cache_base_dir()).unwrap_or_default();
    fs::create_dir_all(sensor_core::get_cache_base_dir()).unwrap();

    // Request root shell
    let root_shell = Arc::new(Mutex::new(RootShell::new()));

    // Create the port handle map wrapped in a mutex
    let app_state_network_handles = Mutex::new(HashMap::new());

    // Read the static sensor values
    let static_sensor_values = Arc::new(sensor::read_static_sensor_values(&root_shell));

    // Create sensor history vector
    let sensor_value_history = Arc::new(Mutex::new(Vec::with_capacity(SENSOR_VALUE_HISTORY_SIZE)));

    // Load the config for all ports
    // If the port is active, start a sync thread
    // And report the handle to the app state
    config::read_from_app_config()
        .network_devices
        .values()
        .filter(|net_config| net_config.active)
        .for_each(|net_config| {
            let thread_handle = start_port_thread(
                &sensor_value_history,
                &static_sensor_values,
                net_config.clone(),
            );
            app_state_network_handles
                .lock()
                .unwrap()
                .insert(net_config.id.clone(), thread_handle);
        });

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState {
            port_handle: app_state_network_handles,
            root_shell: root_shell.clone(),
            static_sensor_values,
            sensor_value_history,
        })
        .setup(|app| {
            let title = format!("Sensor Bridge {}", env!("CARGO_PKG_VERSION"));
            app.get_webview_window("main").unwrap().set_title(&title)?;

            build_tray_icon(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_sensor_values,
            get_app_config,
            create_network_device_config,
            get_network_device_config,
            remove_network_device_config,
            save_app_config,
            enable_display,
            disable_display,
            show_lcd_live_preview,
            get_lcd_preview_image,
            get_text_preview_image,
            get_graph_preview_image,
            get_conditional_image_preview_image,
            verify_network_address,
            import_config,
            export_config,
            get_system_fonts,
            get_conditional_image_repo_entries,
            restart_app,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn build_tray_icon(app: &mut App) -> Result<(), Box<dyn Error>> {
    let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_i, &quit_i])?;
    let _ = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => {
                app.exit(0);
            }
            "show" => {
                // in this example, let's show and focus the main window when the tray is clicked
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {
                println!("menu item {:?} not handled", event.id);
            }
        })
        .on_tray_icon_event(|tray, event| match event {
            TrayIconEvent::Click {
                button: MouseButton::Left,
                ..
            } => {
                println!("left click pressed and released");
                // in this example, let's show and focus the main window when the tray is clicked
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {
                println!("unhandled event {event:?}");
            }
        })
        .build(app)?;
    Ok(())
}

#[tauri::command]
async fn get_sensor_values(app_state: State<'_, AppState>) -> Result<String, ()> {
    let sensor_values = sensor::read_all_sensor_values(
        &app_state.sensor_value_history,
        &app_state.static_sensor_values,
    );
    Ok(serde_json::to_string(&sensor_values).unwrap())
}

#[tauri::command]
async fn create_network_device_config() -> Result<String, ()> {
    let new_network_device_config = config::create_network_device_config();
    Ok(new_network_device_config.id)
}

#[tauri::command]
async fn get_network_device_config(network_device_id: String) -> Result<String, String> {
    let network_device_config = match config::read(&network_device_id) {
        Some(config) => config,
        None => {
            return Err("Config not found".to_string());
        }
    };

    serde_json::to_string(&network_device_config).map_err(|err| err.to_string())
}

#[tauri::command]
async fn remove_network_device_config(network_device_id: String) -> Result<(), ()> {
    config::remove(&network_device_id);
    Ok(())
}

#[tauri::command]
async fn get_app_config() -> Result<String, String> {
    let app_config: AppConfig = config::read_from_app_config();
    serde_json::to_string(&app_config).map_err(|err| err.to_string())
}

/// Saves the address config for the specified address and port.
/// If the address config does not exist, it will be created.
#[tauri::command]
async fn save_app_config(
    app_state: State<'_, AppState>,
    id: String,
    name: String,
    address: String,
    display_config: String,
) -> Result<(), String> {
    let mut network_device_config = match config::read(&id) {
        Some(config) => config,
        None => {
            return Err("Config not found".to_string());
        }
    };

    network_device_config.name = name;
    network_device_config.address = address;
    network_device_config.display_config = serde_json::from_str(display_config.as_str()).unwrap();

    verify_config(&network_device_config)?;

    config::write(&network_device_config);

    reconnect_displays(app_state).await;

    Ok(())
}

/// Enables the sync for the specified address and port.
/// Also set the config for the port to active and save it
#[tauri::command]
async fn enable_display(
    app_state: State<'_, AppState>,
    network_device_id: String,
) -> Result<(), String> {
    let mut network_device_config = match config::read(&network_device_id) {
        Some(config) => config,
        None => {
            return Err("Config not found".to_string());
        }
    };

    verify_config(&network_device_config)?;

    network_device_config.active = true;
    config::write(&network_device_config);

    // Start the sync for the port and hand
    // This creates a new thread and returns a handle to it
    let thread_handle = start_port_thread(
        &app_state.sensor_value_history,
        &app_state.static_sensor_values,
        network_device_config,
    );

    // Add the port handle to the app state
    app_state
        .port_handle
        .lock()
        .unwrap()
        .insert(network_device_id, thread_handle);

    Ok(())
}

/// Disables the sync for the specified address and port.
/// Also set the config for the port to inactive and save it
#[tauri::command]
async fn disable_display(
    app_state: State<'_, AppState>,
    network_device_id: String,
) -> Result<(), String> {
    let mut network_device_config = match config::read(&network_device_id) {
        Some(config) => config,
        None => {
            return Err("Config not found".to_string());
        }
    };
    network_device_config.active = false;
    config::write(&network_device_config);

    // Stop the sync thread for the port
    let port_handle = app_state.port_handle.lock().unwrap();
    stop_sync_thread(&network_device_id, port_handle);

    Ok(())
}

/// Toggles the live preview for the specified lcd address and port.
/// If the live preview is enabled, it will be disabled and vice versa.
#[tauri::command]
async fn show_lcd_live_preview(
    app_handle: AppHandle,
    network_device_id: String,
) -> Result<(), String> {
    let network_device_config = match config::read(&network_device_id) {
        Some(config) => config,
        None => {
            return Err("Config not found".to_string());
        }
    };

    verify_config(&network_device_config)?;

    // If the window is still present, close it
    let existing_window = app_handle.get_webview_window(lcd_preview::WINDOW_LABEL);
    if let Some(window) = existing_window {
        window.close().unwrap();
    }

    // Open a new lcd preview window
    lcd_preview::show(app_handle, network_device_config);

    Ok(())
}

/// Returns the lcd preview image for the specified com port as base64 encoded string
#[tauri::command]
async fn get_lcd_preview_image(
    app_state: State<'_, AppState>,
    app_handle: AppHandle,
    network_device_id: String,
) -> Result<String, String> {
    let network_device_config = match config::read(&network_device_id) {
        Some(config) => config,
        None => {
            return Err("Config not found".to_string());
        }
    };
    let display_config = network_device_config.display_config;

    // If the window is not visible, return an empty string
    let maybe_window = app_handle.get_webview_window(lcd_preview::WINDOW_LABEL);
    if let Some(window) = maybe_window {
        if !window.is_visible().unwrap_or(false) {
            // The window is not visible, return an empty string
            return Ok("".to_string());
        }
    }

    lcd_preview::render(
        &app_state.sensor_value_history,
        &app_state.static_sensor_values,
        display_config,
    )
    .map_err(|_| "Error rendering preview image".to_string())
}

#[tauri::command]
async fn get_text_preview_image(
    app_state: State<'_, AppState>,
    image_width: u32,
    image_height: u32,
    text_config: TextConfig,
) -> Result<String, ()> {
    let sensor_values = &app_state.sensor_value_history.lock().ignore_poison()[0];
    let sensor_id = &text_config.sensor_id;

    let sensor_value = sensor_values
        .iter()
        .find(|sensor_value| sensor_value.id.eq(sensor_id));

    let text_image_data =
        text::render_preview(sensor_value, image_width, image_height, &text_config);

    let engine = base64::engine::general_purpose::STANDARD;
    Ok(base64::Engine::encode(&engine, text_image_data))
}

#[tauri::command]
async fn get_graph_preview_image(
    app_state: State<'_, AppState>,
    mut graph_config: GraphConfig,
) -> Result<String, ()> {
    let sensor_id = &graph_config.sensor_id;

    graph_config.sensor_values = sensor_core::extract_value_sequence(
        app_state
            .sensor_value_history
            .lock()
            .ignore_poison()
            .deref(),
        sensor_id,
    );

    let graph_data = graph_renderer::render(&graph_config);
    let engine = base64::engine::general_purpose::STANDARD;
    Ok(base64::Engine::encode(&engine, graph_data))
}

#[tauri::command]
async fn get_conditional_image_preview_image(
    app_state: State<'_, AppState>,
    element_id: String,
    mut conditional_image_config: ConditionalImageConfig,
) -> Result<String, ()> {
    let sensor_values = &app_state.sensor_value_history.lock().ignore_poison()[0];
    let sensor_id = &conditional_image_config.sensor_id;

    // Filter sensor values for provided sensor id
    let sensor_value = sensor_values
        .iter()
        .find(|sensor_value| sensor_value.id.eq(sensor_id));

    let (value, sensor_type): (&str, &SensorType) = match sensor_value {
        Some(sensor_value) => (&sensor_value.value, &sensor_value.sensor_type),
        _ => ("N/A", &SensorType::Text),
    };

    conditional_image_config.sensor_value = value.to_string();
    conditional_image_config.images_path =
        conditional_image::prepare_element(&element_id, &conditional_image_config);

    let graph_data: Vec<u8> = match conditional_image_renderer::render(
        &element_id,
        sensor_type,
        &conditional_image_config,
    ) {
        Some(data) => data,
        None => {
            error!("Error rendering conditional image for element {element_id} and sensor {sensor_id} and value {value}");
            return Err(());
        }
    };

    let engine = base64::engine::general_purpose::STANDARD;
    Ok(base64::Engine::encode(&engine, graph_data))
}

#[tauri::command]
async fn verify_network_address(address: String) -> bool {
    net_port::verify_network_address(&address)
}

#[tauri::command]
async fn export_config(file_path: String) -> Result<(), ()> {
    export_import::export_configuration(file_path);
    Ok(())
}

#[tauri::command]
async fn import_config(file_path: String) -> Result<(), tauri::Error> {
    let app_config = export_import::import_configuration(file_path);

    if let Ok(app_config) = app_config {
        app_config.network_devices.values().for_each(config::write);
        Ok(())
    } else {
        Err(app_config.err().unwrap().into())
    }
}

#[tauri::command]
async fn get_system_fonts() -> Result<String, String> {
    serde_json::to_string(&fonts::get_all()).map_err(|err| err.to_string())
}

#[tauri::command]
async fn get_conditional_image_repo_entries() -> Result<String, String> {
    let repo_entries = conditional_image::get_repo_entries();
    serde_json::to_string(&repo_entries).map_err(|err| err.to_string())
}

#[tauri::command]
async fn restart_app(app_handle: AppHandle) -> Result<(), ()> {
    app_handle.restart();
}

/// Starts the sync thread for the specified port
/// Returns a handle to the thread
fn start_port_thread(
    sensor_value_history: &Arc<Mutex<Vec<Vec<SensorValue>>>>,
    static_sensor_values: &Arc<Vec<SensorValue>>,
    port_config: NetworkDeviceConfig,
) -> ThreadHandle {
    let port_running_state_handle = Arc::new(Mutex::new(true));
    let port_handle = net_port::start_sync(
        sensor_value_history,
        static_sensor_values,
        port_config,
        port_running_state_handle.clone(),
    );

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

/// Verifies the config for the specified network device
fn verify_config(config: &NetworkDeviceConfig) -> Result<(), String> {
    // Verify all static image path
    for element in config.display_config.elements.iter() {
        // Ensure that the image file exists
        if element.element_type == ElementType::StaticImage {
            let image_path = &element.image_config.as_ref().unwrap().image_path;

            let is_file = fs::metadata(image_path).is_ok();
            let is_url = utils::is_reachable_url(image_path);

            if !is_file && !is_url {
                return Err(format!(
                    "'{}': Image path '{}' does not exist.",
                    element.name, image_path
                ));
            }
        }

        // Ensure that the zip file exists
        if element.element_type == ElementType::ConditionalImage {
            let zip_path = &element
                .conditional_image_config
                .as_ref()
                .unwrap()
                .images_path;

            let exists = if utils::is_reachable_url(zip_path) {
                ureq::head(zip_path).call().is_ok()
            } else {
                fs::metadata(zip_path).is_ok()
            };

            if !exists {
                return Err(format!(
                    "'{}': Filepath '{}' does not exist.",
                    element.name, zip_path
                ));
            }
        }
    }

    Ok(())
}

/// Reconnects all active displays.
/// This is done by disable the sync and re-enable it again (only active displays)
async fn reconnect_displays(app_state: State<'_, AppState>) {
    // Find all active network devices
    let active_network_device_ids = app_state
        .port_handle
        .lock()
        .unwrap()
        .iter()
        .filter(|(_, handle)| *handle.running.lock().unwrap())
        .map(|(id, _)| id.clone())
        .collect::<Vec<String>>();

    // Disable the sync for all active network devices
    for device_id in &active_network_device_ids {
        disable_display(app_state.clone(), device_id.clone())
            .await
            .unwrap_or_default();
    }

    // Re-enable the sync for all active network devices
    for device_id in &active_network_device_ids {
        enable_display(app_state.clone(), device_id.clone())
            .await
            .unwrap_or_default();
    }
}
