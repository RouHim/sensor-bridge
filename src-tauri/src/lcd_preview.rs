use crate::config::ComPortConfig;
use crate::sensor;

use base64::Engine;
use sensor_core::LcdConfig;
use std::io::{Cursor, Seek, SeekFrom};
use tauri::AppHandle;

// Constant for the window label
pub const WINDOW_LABEL: &str = "lcd_preview";

//noinspection RsWrongGenericArgumentsNumber
pub fn open(app_handle: AppHandle, port_config: &ComPortConfig) {
    let com_port = &port_config.com_port;

    let lcd_preview_window = tauri::WindowBuilder::new(
        &app_handle,
        WINDOW_LABEL,
        tauri::WindowUrl::App(format!("lcd_preview.html#{com_port}").into()),
    )
    .build()
    .unwrap();

    lcd_preview_window.set_title("LCD Preview").unwrap();
    lcd_preview_window.set_resizable(false).unwrap();
    lcd_preview_window
        .set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: port_config.lcd_config.resolution_width,
            height: port_config.lcd_config.resolution_height,
        }))
        .unwrap();

    lcd_preview_window.show().unwrap();
}

pub fn generate(lcd_config: LcdConfig) -> String {
    // Read the sensor values
    let sensor_values = sensor::read_all_sensor_values();

    // Render the image
    let buf = sensor_core::render_lcd_image(lcd_config, sensor_values);

    // Encode the buffer to a base64 string
    let engine = base64::engine::general_purpose::STANDARD;

    // Return the base64 string
    base64::Engine::encode(&engine, &buf)
}
