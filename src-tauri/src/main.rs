#![cfg_attr(not(debug_assertions), deny(warnings))]

use crate::config::{AppConfig, NetworkDeviceConfig};
use crate::utils::LockResultExt;
use log::error;
use sensor_core::{
    conditional_image_renderer, graph_renderer, ConditionalImageConfig, GraphConfig,
    SensorType, SensorValue, TextConfig,
};
use std::error::Error;
use std::ops::Deref;
use std::sync::{Arc, Mutex};
use std::{fs};
use super_shell::RootShell;
use tauri::menu::{Menu, MenuItem};
use tauri::{
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    App, State,
};
use tauri::{AppHandle, Manager};
use tokio;

mod conditional_image;
pub(crate) mod config;
mod export_import;
mod fonts;
mod http_server;
mod lcd_preview;
mod linux_dmidecode_sensors;
mod linux_lm_sensors;
mod linux_system_sensors;
mod misc_sensor;
mod sensor;
mod static_image;
mod system_stat_sensor;
mod text;
mod utils;

#[cfg(test)]
mod fonts_test;
mod linux_amdgpu;

pub struct AppState {
    pub root_shell: Arc<Mutex<Option<RootShell>>>,
    pub static_sensor_values: Arc<Vec<SensorValue>>,
    pub sensor_value_history: Arc<Mutex<Vec<Vec<SensorValue>>>>,
}

// Number of elements to be stored in the sensor value history
pub const SENSOR_VALUE_HISTORY_SIZE: usize = 1000;

#[tokio::main]
async fn main() {
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

    // Read the static sensor values
    let static_sensor_values = Arc::new(sensor::read_static_sensor_values(&root_shell));

    // Create sensor history vector
    let sensor_value_history = Arc::new(Mutex::new(Vec::with_capacity(SENSOR_VALUE_HISTORY_SIZE)));

    // Start HTTP server in background
    let sensor_values_clone = static_sensor_values.clone();
    let sensor_history_clone = sensor_value_history.clone();

    tokio::spawn(async move {
        if let Err(e) = http_server::start_http_server(
            sensor_values_clone,
            sensor_history_clone,
            Some(8080),
        ).await {
            error!("HTTP server failed: {}", e);
        }
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState {
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
            get_registered_clients,
            update_client_name,
            remove_registered_client,
            set_client_active,
            update_client_display_config,
            show_lcd_live_preview,
            get_lcd_preview_image,
            get_text_preview_image,
            get_graph_preview_image,
            get_conditional_image_preview_image,
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

/// Gets all registered clients
#[tauri::command]
async fn get_registered_clients() -> Result<String, String> {
    let app_config: AppConfig = config::read_from_app_config();
    serde_json::to_string(&app_config.registered_clients).map_err(|err| err.to_string())
}

/// Updates a client's name
#[tauri::command]
async fn update_client_name(mac_address: String, name: String) -> Result<(), String> {
    config::update_client_name(&mac_address, name)
}

/// Removes a registered client
#[tauri::command]
async fn remove_registered_client(mac_address: String) -> Result<(), String> {
    config::remove_client(&mac_address)
}

/// Sets a client's active status
#[tauri::command]
async fn set_client_active(mac_address: String, active: bool) -> Result<(), String> {
    config::set_client_active(&mac_address, active)
}

/// Updates a client's display configuration
#[tauri::command]
async fn update_client_display_config(mac_address: String, display_config: String) -> Result<(), String> {
    let display_config: sensor_core::DisplayConfig = serde_json::from_str(&display_config)
        .map_err(|e| format!("Invalid display config JSON: {}", e))?;

    config::update_client_display_config(&mac_address, display_config)
}

/// Shows LCD live preview for a registered client
#[tauri::command]
async fn show_lcd_live_preview(
    app_handle: AppHandle,
    mac_address: String,
) -> Result<(), String> {
    let client = config::get_client(&mac_address)
        .ok_or_else(|| format!("Client with MAC address {} not found", mac_address))?;

    // Convert RegisteredClient to NetworkDeviceConfig for compatibility with existing preview system
    let network_device_config = NetworkDeviceConfig {
        id: mac_address.clone(),
        name: client.name,
        address: client.ip_address,
        active: client.active,
        display_config: client.display_config,
    };

    // If the window is still present, close it
    let existing_window = app_handle.get_webview_window(lcd_preview::WINDOW_LABEL);
    if let Some(window) = existing_window {
        window.close().unwrap();
    }

    // Open a new lcd preview window
    lcd_preview::show(app_handle, network_device_config);

    Ok(())
}

/// Returns the lcd preview image for a registered client as base64 encoded string
#[tauri::command]
async fn get_lcd_preview_image(
    app_state: State<'_, AppState>,
    app_handle: AppHandle,
    mac_address: String,
) -> Result<String, String> {
    let client = config::get_client(&mac_address)
        .ok_or_else(|| format!("Client with MAC address {} not found", mac_address))?;

    let display_config = client.display_config;

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
async fn verify_network_address(_address: String) -> bool {
    // Legacy function - no longer needed with HTTP registration
    // Return true for backward compatibility
    true
}

#[tauri::command]
async fn export_config(file_path: String) -> Result<(), ()> {
    export_import::export_configuration(file_path);
    Ok(())
}

#[tauri::command]
async fn import_config(file_path: String) -> Result<(), tauri::Error> {
    let _app_config = export_import::import_configuration(file_path);

    // Migration from old network_devices format to new registered_clients format
    // This maintains backward compatibility during the transition
    Ok(())
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
