use std::fs::File;
use std::io::Write;
use base64::{Engine, engine};
use image::{DynamicImage, RgbImage};
use image::DynamicImage::ImageRgb8;

pub fn to_base64(image: RgbImage) -> String {
    let bytes = image.as_raw().as_slice();

    let base64 = base64::encode(bytes);
    println!("base64: {}", base64);

    return base64;
}