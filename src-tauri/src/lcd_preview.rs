use log::info;
use std::sync::Arc;
use std::{fs, thread};

use rayon::prelude::*;
use sensor_core::{ElementType, LcdConfig, LcdElement, SensorValue};
use tauri::AppHandle;

use crate::config::NetPortConfig;
use crate::{sensor, utils};

/// Constant for the window label
pub const WINDOW_LABEL: &str = "lcd_preview";

/// Shows the lcd preview window
/// This function is called from the main thread
/// Therefore we need to spawn a new thread to show the window
/// Otherwise the window will not be shown
//noinspection RsWrongGenericArgumentsNumber
pub fn show(app_handle: AppHandle, port_config: &NetPortConfig) {
    let network_device_id = port_config.id.clone();
    let width = port_config.lcd_config.resolution_width;
    let height = port_config.lcd_config.resolution_height;
    let lcd_elements = port_config.lcd_config.elements.clone();

    info!("Showing lcd preview for {}", port_config.name);

    thread::spawn(move || {
        // Prepare static assets
        prepare_assets(lcd_elements);

        let lcd_preview_window = tauri::WindowBuilder::new(
            &app_handle,
            WINDOW_LABEL,
            tauri::WindowUrl::App(format!("lcd_preview.html#{network_device_id}").into()),
        )
        .build()
        .unwrap();

        lcd_preview_window.set_title("LCD Preview").unwrap();
        lcd_preview_window.set_resizable(false).unwrap();
        lcd_preview_window
            .set_size(tauri::Size::Physical(tauri::PhysicalSize { width, height }))
            .unwrap();

        lcd_preview_window.show().unwrap();
    });
}

/// Prepares the static assets for the lcd preview window
fn prepare_assets(elements: Vec<LcdElement>) {
    // Ensure data folder exists and is empty
    fs::remove_dir_all(sensor_core::ASSET_DATA_DIR).unwrap_or_default(); // Ignore errors
    fs::create_dir_all(sensor_core::ASSET_DATA_DIR).unwrap();

    elements
        .par_iter()
        .filter(|element| element.element_type == ElementType::StaticImage)
        .for_each(|element| {
            // Render image to desired size
            let image_config = &element.image_config;
            let image = image::open(&image_config.image_path).unwrap();
            let image = image.resize_exact(
                image_config.image_width,
                image_config.image_height,
                image::imageops::FilterType::Lanczos3,
            );

            // Convert to png
            let image_data = utils::rgba_to_png_bytes(image);

            // Save to data folder
            let target_path = format!("{}/{}", sensor_core::ASSET_DATA_DIR, element.id);
            fs::write(target_path, image_data).unwrap();
        });
}

/// Returns the lcd preview image for the specified com port as base64 encoded string
/// This function is called from the main thread
/// Therefore we need to spawn a new thread to render the image
pub fn render(static_sensor_values: &Arc<Vec<SensorValue>>, lcd_config: LcdConfig) -> String {
    let static_sensor_values = static_sensor_values.clone();
    let lcd_config = lcd_config.clone();

    thread::spawn(move || {
        // Read the sensor values
        let sensor_values = sensor::read_all_sensor_values(&static_sensor_values);

        // Render the image
        let image = sensor_core::render_lcd_image(lcd_config, sensor_values);

        let buf = utils::rgb_to_jpeg_bytes(image);

        // Encode the buffer to a base64 string
        let engine = base64::engine::general_purpose::STANDARD;

        // Return the base64 string
        base64::Engine::encode(&engine, buf)
    })
    .join()
    .unwrap()
}
