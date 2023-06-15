use std::fmt::format;
use std::io::{Cursor, Seek, SeekFrom};
use image::{DynamicImage, GenericImageView, ImageBuffer, ImageOutputFormat, RgbImage};
use image::DynamicImage::ImageRgb8;
use rusttype::{Font, Scale};
use tauri::AppHandle;
use crate::{config, sensor};
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
    // Snapshot start time
    let start = std::time::Instant::now();

    // Create a new ImageBuffer with the specified resolution only in black
    let mut image = ImageBuffer::new(lcd_config.resolution_width, lcd_config.resolution_height);
    for (x, y, pixel) in image.enumerate_pixels_mut() {
        *pixel = image::Rgb([0, 0, 0]);
    }

    // Snapshot end time and print the duration
    let end = std::time::Instant::now();
    println!("After to build bg {}ms", end.duration_since(start).as_millis());

    // Draw a simple text on the image using imageproc
    let font_data = Vec::from(include_bytes!("../../fonts/Roboto-Regular.ttf") as &[u8]);
    let font = Font::try_from_vec(font_data).unwrap();
    let font_scale = Scale::uniform(20.0);
    let font_color = image::Rgb([255, 255, 255]);

    // Snapshot end time and print the duration
    let end = std::time::Instant::now();
    println!("After font setup bg {}ms", end.duration_since(start).as_millis());

    // TODO: this takes a lot of time
    let sensor_values = sensor::read_all_sensor_values();

    // Snapshot end time and print the duration
    let end = std::time::Instant::now();
    println!("After to read sensor bg {}ms", end.duration_since(start).as_millis());

    // Iterate over lcd elements and draw them on the image
    for lcd_element in lcd_config.elements {
        let x = lcd_element.x as i32;
        let y = lcd_element.y as i32;
        let sensor_id = lcd_element.sensor_id.as_str();
        let text_format = lcd_element.text_format;

        // Get the sensor value from the sensor_values Vec by sensor_id
        let sensor_value = sensor_values.iter().find(|&s| s.id == sensor_id).unwrap();

        let value = sensor_value.value.as_str();
        let unit = sensor_value.unit.as_str();
        let text = text_format.replace("{value}", value).replace("{unit}", unit);

        imageproc::drawing::draw_text_mut(&mut image, font_color, x, y, font_scale, &font, text.as_str());
    }

    // Snapshot end time and print the duration
    let end = std::time::Instant::now();
    println!("After to draw elements {}ms", end.duration_since(start).as_millis());

    // Convert the ImageBuffer to a DynamicImage RGB8
    let dynamic_img = ImageRgb8(image);

    // Snapshot end time and print the duration
    let end = std::time::Instant::now();
    println!("After to rmgb8 img {}ms", end.duration_since(start).as_millis());

    // Create a Vec<u8> buffer to write the image to it
    let mut buf = Vec::new();
    let mut cursor = Cursor::new(&mut buf);
    dynamic_img.write_to(&mut cursor, ImageOutputFormat::Png).unwrap();

    // Snapshot end time and print the duration
    let end = std::time::Instant::now();
    println!("After write to dyn img {}ms", end.duration_since(start).as_millis());

    // Reset the cursor to the beginning of the buffer
    cursor.seek(SeekFrom::Start(0)).unwrap();

    // Encode the buffer to a base64 string
    let res_base64 = base64::encode(&buf);

    // Snapshot end time and print the duration
    let end = std::time::Instant::now();
    println!("After base 64 {}ms", end.duration_since(start).as_millis());

    // Return the base64 string
    res_base64
}