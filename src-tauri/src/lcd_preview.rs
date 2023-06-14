use std::fmt::format;
use image::{DynamicImage, GenericImageView, ImageBuffer};
use tauri::AppHandle;
use crate::config;
use crate::config::{ComPortConfig, LcdConfig};

//noinspection RsWrongGenericArgumentsNumber
pub fn open(app_handle: AppHandle, port_config: &ComPortConfig) {
    let com_port = &port_config.com_port;

    let docs_window = tauri::WindowBuilder::new(
        &app_handle,
        "lcd_preview",
        tauri::WindowUrl::App(format!("lcd_preview.html#{com_port}").into()),
    ).build().unwrap();
    docs_window.show().unwrap();
}

pub fn generate(lcd_config: LcdConfig) -> DynamicImage {
    // Load image from: /home/rouven/Downloads/test.jpg
    let image = image::open("/home/rouven/Downloads/test.jpg").unwrap();

    image
}