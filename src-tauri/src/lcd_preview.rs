use std::ops::Deref;
use std::sync::{Arc, Mutex};
use std::thread;

use log::info;
use rayon::prelude::*;
use sensor_core::{ElementType, LcdConfig, LcdElement, SensorValue};
use tauri::AppHandle;

use crate::config::NetPortConfig;
use crate::{conditional_image, sensor, static_image, utils};

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
            conditional_image::prepare_element(&element.id, &element.conditional_image_config);
        });
}

/// Returns the lcd preview image for the specified com port as base64 encoded string
/// This function is called from the main thread
/// Therefore we need to spawn a new thread to render the image
pub fn render(
    sensor_value_history: &Arc<Mutex<Vec<Vec<SensorValue>>>>,
    static_sensor_values: &Arc<Vec<SensorValue>>,
    lcd_config: LcdConfig,
) -> String {
    let static_sensor_values = static_sensor_values.clone();
    let sensor_value_history = sensor_value_history.clone();
    let lcd_config = lcd_config.clone();

    thread::spawn(move || {
        // Read the sensor values
        sensor::read_all_sensor_values(&sensor_value_history, &static_sensor_values);

        // Render the image
        let image =
            sensor_core::render_lcd_image(lcd_config, sensor_value_history.lock().unwrap().deref());

        let buf = utils::rgb_to_jpeg_bytes(image);

        // Encode the buffer to a base64 string
        let engine = base64::engine::general_purpose::STANDARD;

        // Return the base64 string
        base64::Engine::encode(&engine, buf)
    })
    .join()
    .unwrap()
}
