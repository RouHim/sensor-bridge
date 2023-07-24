use crate::sensor;

use crate::config::NetPortConfig;

use sensor_core::LcdConfig;
use std::io::{Cursor, Seek, SeekFrom};
use std::thread;
use tauri::AppHandle;

// Constant for the window label
pub const WINDOW_LABEL: &str = "lcd_preview";

//noinspection RsWrongGenericArgumentsNumber
pub fn open(app_handle: AppHandle, port_config: &NetPortConfig) {
    let network_device_id = port_config.id.clone();
    let width = port_config.lcd_config.resolution_width;
    let height = port_config.lcd_config.resolution_height;

    thread::spawn(move || {
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

/// Returns the lcd preview image for the specified com port as base64 encoded string
pub fn render(lcd_config: LcdConfig) -> String {
    // Read the sensor values
    let sensor_values = sensor::read_all_sensor_values();

    // Render the image
    let image = sensor_core::render_lcd_image(lcd_config, sensor_values);

    // Create a Vec<u8> buffer to write the image to it
    let mut buf = Vec::new();
    let mut cursor = Cursor::new(&mut buf);
    image
        .write_to(&mut cursor, image::ImageOutputFormat::Png)
        .unwrap();

    // Reset the cursor to the beginning of the buffer
    cursor.seek(SeekFrom::Start(0)).unwrap();

    // Encode the buffer to a base64 string
    let engine = base64::engine::general_purpose::STANDARD;

    // Return the base64 string
    base64::Engine::encode(&engine, &buf)
}
