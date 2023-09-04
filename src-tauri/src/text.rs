use std::fs;
use std::io::{BufWriter, Cursor};

use font_loader::system_fonts;
use image::Rgba;
use imageproc::drawing;
use rusttype::Scale;
use sensor_core::{
    DisplayConfig, ElementConfig, ElementType, PrepareTextData, SensorValue, TextConfig,
    TransportMessage, TransportType,
};

/// Prepares the static font assets for the lcd preview window.
pub fn prepare(element: &ElementConfig) {
    // Pre-Render image to desired size
    let text_config = element.text_config.as_ref().unwrap();
    let font_family = system_fonts::FontPropertyBuilder::new()
        .family(&text_config.font_family)
        .build();
    let font_data = system_fonts::get(&font_family).unwrap().0;

    // ensure folder exists and is empty
    let text_cache_folder = sensor_core::get_cache_dir(&element.id, &ElementType::Text);
    fs::remove_dir_all(&text_cache_folder).unwrap_or_default(); // Ignore errors
    fs::create_dir_all(&text_cache_folder).unwrap();

    // Save to cache folder
    let cache_file = text_cache_folder.join(&element.id);
    fs::write(cache_file, font_data).unwrap();
}

pub fn prepare_display(display_config: &DisplayConfig) -> PrepareTextData {
    let font_data = display_config
        .elements
        .iter()
        .filter(|element| element.element_type == ElementType::Text)
        .map(|text_element| {
            let text_config = text_element.text_config.as_ref().unwrap();
            let font_family = system_fonts::FontPropertyBuilder::new()
                .family(&text_config.font_family)
                .build();
            let font_data = system_fonts::get(&font_family).unwrap().0;
            (text_element.id.clone(), font_data)
        })
        .collect();

    PrepareTextData { font_data }
}

/// Get all system fonts.
pub fn get_system_fonts() -> Vec<String> {
    system_fonts::query_all()
}

/// Renders the preview image for the specified text element.
/// First renders the "full sized" image and then crops it to the text element desired size.
/// This is needed to get the correct text scaled.
pub fn render_preview(
    sensor_value: Option<&SensorValue>,
    image_width: u32,
    image_height: u32,
    text_config: &TextConfig,
) -> Vec<u8> {
    // Initialize image buffer
    let mut image = image::RgbaImage::new(image_width, image_height);

    let font_scale = Scale::uniform(text_config.font_size as f32);
    let font_color: Rgba<u8> = sensor_core::hex_to_rgba(&text_config.font_color);
    let text_format = &text_config.format;

    let (value, unit): (&str, &str) = match sensor_value {
        Some(sensor_value) => (&sensor_value.value, &sensor_value.unit),
        _ => ("N/A", ""),
    };

    // Replace placeholders in text format
    let text = text_format
        .replace("{value}", value)
        .replace("{unit}", unit);

    let font_family = system_fonts::FontPropertyBuilder::new()
        .family(&text_config.font_family)
        .build();
    let font_data = system_fonts::get(&font_family).unwrap().0;
    let font = rusttype::Font::try_from_bytes(&font_data).unwrap();

    // Draw text on image
    drawing::draw_text_mut(
        &mut image,
        font_color,
        0,
        0,
        font_scale,
        &font,
        text.as_str(),
    );

    // Crop image buffer to desired size text element size
    let cropped_image =
        image::imageops::crop_imm(&image, 0, 0, text_config.width, text_config.height).to_image();

    // Render to png
    let mut writer = BufWriter::new(Cursor::new(Vec::new()));
    cropped_image
        .write_to(&mut writer, image::ImageOutputFormat::Png)
        .unwrap();

    writer.into_inner().unwrap().into_inner()
}

/// Serializes the render data to bytes using messagepack
/// and wraps it in a TransportMessage
/// Returns the bytes to send
pub fn serialize(text_data: PrepareTextData) -> Vec<u8> {
    let transport_message = TransportMessage {
        transport_type: TransportType::PrepareText,
        data: bincode::serialize(&text_data).unwrap(),
    };
    bincode::serialize(&transport_message).unwrap()
}
