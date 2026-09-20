use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, RwLock};
use std::thread;

use log::info;
use rayon::prelude::*;
use sensor_core::{ElementConfig, ElementType, SensorValue};
use tauri::{AppHandle, Manager};

use crate::http_server::DisplayClient;
use crate::utils::LockResultExt;
use crate::AppState;
use crate::{conditional_image, fonts, static_image, utils};

/// Constant for the window label
pub const WINDOW_LABEL: &str = "lcd-preview";

/// Shows the display preview window
/// This function is called from the main thread
/// Therefore we need to spawn a new thread to show the window
/// Otherwise the window will not be shown
pub fn show(app_handle: AppHandle, client: &DisplayClient) {
    let network_device_id = client.mac_address.clone();
    let width = client.resolution_width;
    let height = client.resolution_height;
    let lcd_elements = client.elements.clone();

    info!("Showing display preview for '{}'", client.name);

    thread::spawn(move || {
        // Check if window already exists and handle it properly
        if let Some(existing_window) = app_handle.get_webview_window(WINDOW_LABEL) {
            // Window already exists, destroy it immediately to force cleanup
            if let Err(e) = existing_window.destroy() {
                log::error!("Failed to destroy existing LCD preview window: {}", e);
                return; // Exit if we can't destroy the window
            }

            // Give a brief moment for Tauri to process the destruction
            thread::sleep(std::time::Duration::from_millis(50));

            // Verify the window is actually gone
            if app_handle.get_webview_window(WINDOW_LABEL).is_some() {
                log::error!("Window still exists after destroy() call");
                return;
            }

            info!("Successfully destroyed existing LCD preview window");
        }

        // Create a new window (either because none existed or we successfully destroyed the existing one)
        // Prepare static assets. The preview prepares the very same
        // element-id-keyed folders the HTTP static-data path rebuilds, so it
        // must take the shared preparation mutex: an overlapping cold
        // static-data preparation would otherwise observe an
        // emptied-but-not-yet-refilled directory and cache the degraded empty
        // payload. The guard is released before the window is built - it must
        // not be held while the preview runs.
        let cache = app_handle.state::<AppState>().static_data_cache.clone();
        let prepare_lock = cache.lock().ignore_poison().prepare_lock();

        {
            let _preparing = prepare_lock.lock().ignore_poison();
            prepare_assets(lcd_elements);
        }

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
                let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                    width: width as u32,
                    height: height as u32,
                }));
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
            if let Err(e) = static_image::prepare(element) {
                log::error!(
                    "Failed to prepare static image for element {}: {}",
                    element.id,
                    e
                );
            }
        });

    elements
        .par_iter()
        .filter(|element| element.element_type == ElementType::ConditionalImage)
        .for_each(|element| {
            let _ = conditional_image::prepare_element(
                &element.id,
                element.conditional_image_config.as_ref().unwrap(),
            );
        });
}

/// Returns the lcd preview image for the specified com port as base64 encoded string
/// This function is called from the main thread
/// Therefore we need to spawn a new thread to render the image
pub fn render(
    sensor_value_history: &Arc<RwLock<VecDeque<Vec<SensorValue>>>>,
    client: DisplayClient,
) -> Result<String, String> {
    let sensor_value_history = sensor_value_history.clone();

    thread::spawn(move || {
        // Build font data hashmap (ignore hashes for preview). The preview uses
        // the permissive loader so that a font family which is not installed
        // falls back to a system font instead of failing the whole preview.
        let mut fonts_data: HashMap<String, Vec<u8>> = HashMap::new();
        for element in client
            .elements
            .iter()
            .filter(|element| element.element_type == ElementType::Text)
        {
            let Some(text_config) = element.text_config.as_ref() else {
                continue;
            };

            fonts_data.insert(
                text_config.font_family.clone(),
                fonts::load_data(&text_config.font_family),
            );
        }

        // Take the history only for the render; the JPEG and base64 encoding run
        // after the lock is released so the sampler is never blocked by them.
        let image = {
            let history = sensor_value_history.read().ignore_poison();
            if history.is_empty() {
                return Err("No sensor data available yet".to_string());
            }

            sensor_core::render_lcd_image(
                &client.elements,
                &history,
                &fonts_data,
                client.resolution_width,
                client.resolution_height,
            )
        };

        let buf = utils::rgb_to_jpeg_bytes(image);
        let engine = base64::engine::general_purpose::STANDARD;
        Ok(base64::Engine::encode(&engine, buf))
    })
    .join()
    .map_err(|_| "LCD preview render thread panicked".to_string())?
}
