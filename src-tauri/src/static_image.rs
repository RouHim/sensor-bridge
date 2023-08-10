use std::collections::HashMap;
use std::fs;

use rayon::iter::{IntoParallelRefIterator, ParallelIterator};
use sensor_core::{
    ElementType, ImageConfig, LcdConfig, LcdElement, PrepareStaticImageData, TransportMessage,
    TransportType,
};

use crate::utils;

/// Pre-renders static images and saves them into the cache folder.
/// Thus they can be loaded without modification from filesystem in the render loop.
pub fn prepare(element: &LcdElement) {
    // Pre-Render image to desired size
    let image_config = &element.image_config;
    let image = image::open(&image_config.image_path).unwrap();
    let image = image.resize_exact(
        image_config.width,
        image_config.height,
        image::imageops::FilterType::Lanczos3,
    );
    // Convert to png
    let image_data = utils::rgba_to_png_bytes(image);

    // ensure folder exists and is empty
    let static_image_cache_folder =
        sensor_core::get_cache_dir(&element.id, ElementType::StaticImage);
    fs::remove_dir_all(&static_image_cache_folder).unwrap_or_default(); // Ignore errors
    fs::create_dir_all(&static_image_cache_folder).unwrap();

    // Save to cache folder
    let cache_file = static_image_cache_folder.join(&element.id);
    fs::write(cache_file, image_data).unwrap();
}

/// Pre-renders static images and serializes the render data to bytes using messagepack
pub fn prepare_images(lcd_config: &LcdConfig) -> PrepareStaticImageData {
    let image_data: HashMap<String, Vec<u8>> = lcd_config
        .elements
        .par_iter()
        .filter(|element| element.element_type == ElementType::StaticImage)
        .map(|element| prepare_image(&element.id, &element.image_config))
        .collect();

    PrepareStaticImageData {
        images_data: image_data,
    }
}

/// Serializes the render data to bytes using messagepack
/// and wraps it in a TransportMessage
/// Returns the bytes to send
pub fn serialize(static_image_data: PrepareStaticImageData) -> Vec<u8> {
    let transport_message = TransportMessage {
        transport_type: TransportType::PrepareStaticImage,
        data: bincode::serialize(&static_image_data).unwrap(),
    };
    bincode::serialize(&transport_message).unwrap()
}

/// Reads each image into memory, scales it to the desired resolution, and returns it
pub fn prepare_image(element_id: &str, image_config: &ImageConfig) -> (String, Vec<u8>) {
    let image = image::open(&image_config.image_path).unwrap();
    let image = image.resize_exact(
        image_config.width,
        image_config.height,
        image::imageops::FilterType::Lanczos3,
    );
    // convert to png
    let image_data = utils::rgba_to_png_bytes(image);

    // Build response entry
    (element_id.to_string(), image_data)
}
