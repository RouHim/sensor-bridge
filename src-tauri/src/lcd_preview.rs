use std::fmt::format;
use std::io::{Cursor, Seek, SeekFrom};
use image::{DynamicImage, GenericImageView, ImageBuffer, ImageOutputFormat, RgbImage};
use image::DynamicImage::ImageRgb8;
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

pub fn generate(lcd_config: LcdConfig) -> String {
    // Erstellen Sie einen RgbImage-Puffer mit nur roten Pixeln
    let mut image = ImageBuffer::new(lcd_config.resolution_width, lcd_config.resolution_height);
    for (x, y, pixel) in image.enumerate_pixels_mut() {
        *pixel = image::Rgb([255, 0, 0]);
    }

    // Konvertieren Sie den ImageBuffer in ein DynamicImage
    let dynamic_img = DynamicImage::ImageRgb8(image);

    // Schreiben Sie das DynamicImage als PNG in einen Vec<u8> mit einem Cursor
    let mut buf = Vec::new();
    let mut cursor = Cursor::new(&mut buf);
    dynamic_img.write_to(&mut cursor, ImageOutputFormat::Png).unwrap();

    // Stellen Sie sicher, dass der Cursor auf den Anfang des Buffers zeigt
    cursor.seek(SeekFrom::Start(0)).unwrap();

    // Konvertieren Sie den Vec<u8> in einen Base64-String
    let res_base64 = base64::encode(&buf);

    // Geben Sie den Base64-String zurück
    res_base64
}