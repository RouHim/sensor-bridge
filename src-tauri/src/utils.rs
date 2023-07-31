use image::{RgbImage, RgbaImage};
use std::io::{Cursor, Seek, SeekFrom};

/// Pretty print bytes, e.g. 534 MB
/// Returns a tuple of (value, unit)
pub fn pretty_bytes(value: usize) -> (f64, String) {
    let mut value = value as f64;
    let mut unit = 0;
    let units = vec!["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    while value > 1024f64 {
        value /= 1024f64;
        unit += 1;
    }

    (value, units[unit].to_string())
}

/// Convert an rgb image to a png buffer
pub fn rgb_to_png_raw(image: RgbImage) -> Vec<u8> {
    // Create a Vec<u8> buffer to write the image to it
    let mut buf = Vec::new();
    let mut cursor = Cursor::new(&mut buf);
    image
        .write_to(&mut cursor, image::ImageOutputFormat::Png)
        .unwrap();

    // Reset the cursor to the beginning of the buffer
    cursor.seek(SeekFrom::Start(0)).unwrap();
    buf
}

/// Convert rgba an image to a png buffer
pub fn rgba_to_png_raw(image: RgbaImage) -> Vec<u8> {
    // Create a Vec<u8> buffer to write the image to it
    let mut buf = Vec::new();
    let mut cursor = Cursor::new(&mut buf);
    image
        .write_to(&mut cursor, image::ImageOutputFormat::Png)
        .unwrap();

    // Reset the cursor to the beginning of the buffer
    cursor.seek(SeekFrom::Start(0)).unwrap();
    buf
}
