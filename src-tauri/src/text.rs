use std::fs;
use std::io::{BufWriter, Cursor};

use font_loader::system_fonts;
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
/// Render Pipeline:
///     1. Draw text on empty rgba buffer on display size
///     2. Calculate bounding box of text
///     3. Crop buffer to the visible bounding box of the text
///     4. Create a new Image buffer in the size of the text element
///     5. Overlay the text image on the new image buffer according to the text alignment
pub fn render_preview(
    sensor_value: Option<&SensorValue>,
    image_width: u32,
    image_height: u32,
    text_config: &TextConfig,
) -> Vec<u8> {
    // Initialize image buffer
    let font_family = system_fonts::FontPropertyBuilder::new()
        .family(&text_config.font_family)
        .build();
    let font_data = system_fonts::get(&font_family).unwrap().0;
    let font = rusttype::Font::try_from_bytes(&font_data).unwrap();

    let text_image = sensor_core::text_renderer::render(
        image_width,
        image_height,
        text_config,
        sensor_value,
        &font,
    );

    // Render to png
    let mut writer = BufWriter::new(Cursor::new(Vec::new()));
    text_image
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
