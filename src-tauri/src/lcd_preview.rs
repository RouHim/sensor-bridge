use std::collections::HashMap;
use std::ops::Deref;
use std::sync::{Arc, Mutex};
use std::thread;

use log::info;
use rayon::prelude::*;
use sensor_core::{DisplayConfig, ElementConfig, ElementType, SensorValue};
use tauri::{AppHandle, Manager};

use crate::config::NetworkDeviceConfig;
use crate::utils::LockResultExt;
use crate::{conditional_image, sensor, static_image, text, utils};

/// Constant for the window label
pub const WINDOW_LABEL: &str = "lcd_preview";

/// Shows the display preview window
/// This function is called from the main thread
/// Therefore we need to spawn a new thread to show the window
/// Otherwise the window will not be shown
pub fn show(app_handle: AppHandle, port_config: NetworkDeviceConfig) {
    let network_device_id = port_config.id.clone();
    let width = port_config.display_config.resolution_width;
    let height = port_config.display_config.resolution_height;
    let lcd_elements = port_config.display_config.elements.clone();

    info!("Showing display preview for '{}'", port_config.name);

    thread::spawn(move || {
        // Check if window already exists and handle it properly
        if let Some(existing_window) = app_handle.get_webview_window(WINDOW_LABEL) {
            // Window already exists, destroy it immediately to force cleanup
            if let Err(e) = existing_window.destroy() {
                log::error!("Failed to destroy existing LCD preview window: {}", e);
                return; // Exit if we can't destroy the window
            }

            // Give a brief moment for Tauri to process the destruction
            std::thread::sleep(std::time::Duration::from_millis(50));

            // Verify the window is actually gone
            if app_handle.get_webview_window(WINDOW_LABEL).is_some() {
                log::error!("Window still exists after destroy() call");
                return;
            }

            log::info!("Successfully destroyed existing LCD preview window");
        }

        // Create a new window (either because none existed or we successfully destroyed the existing one)
        // Prepare static assets
        prepare_assets(lcd_elements);

        let lcd_preview_window = tauri::WebviewWindowBuilder::new(
            &app_handle,
            WINDOW_LABEL,
            tauri::WebviewUrl::App(format!("lcd_preview.html#{network_device_id}").into()),
        )
        .build();

        match lcd_preview_window {
            Ok(window) => {
                let _ = window.set_title("LCD Preview");
                let _ = window.set_resizable(false);
                let _ =
                    window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width, height }));
                let _ = window.show();
            }
            Err(e) => {
                log::error!("Failed to create LCD preview window: {}", e);
            }
        }
    });
}

/// Prepares the static assets for the lcd preview window
fn prepare_assets(elements: Vec<ElementConfig>) {
    elements
        .par_iter()
        .filter(|element| element.element_type == ElementType::StaticImage)
        .for_each(|element| {
            static_image::prepare(element);
        });

    elements
        .par_iter()
        .filter(|element| element.element_type == ElementType::ConditionalImage)
        .for_each(|element| {
            conditional_image::prepare_element(
                &element.id,
                element.conditional_image_config.as_ref().unwrap(),
            );
        });
}

/// Returns the lcd preview image for the specified com port as base64 encoded string
/// This function is called from the main thread
/// Therefore we need to spawn a new thread to render the image
pub fn render(
    sensor_value_history: &Arc<Mutex<Vec<Vec<SensorValue>>>>,
    static_sensor_values: &Arc<Vec<SensorValue>>,
    lcd_config: DisplayConfig,
) -> std::thread::Result<String> {
    let static_sensor_values = static_sensor_values.clone();
    let sensor_value_history = sensor_value_history.clone();
    let lcd_config = lcd_config.clone();

    thread::spawn(move || {
        // Read the sensor values
        sensor::read_all_sensor_values(&sensor_value_history, &static_sensor_values);

        // Build font data hashmap
        let fonts_data: HashMap<String, Vec<u8>> = text::build_fonts_data(&lcd_config);

        // Render the image
        let image = sensor_core::render_lcd_image(
            lcd_config,
            sensor_value_history.lock().ignore_poison().deref(),
            &fonts_data,
        );

        let buf = utils::rgb_to_jpeg_bytes(image);

        // Encode the buffer to a base64 string
        let engine = base64::engine::general_purpose::STANDARD;

        // Return the base64 string
        base64::Engine::encode(&engine, buf)
    })
    .join()
}
