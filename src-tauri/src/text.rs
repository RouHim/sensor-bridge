use std::collections::HashMap;
use std::io::{BufWriter, Cursor};

use font_loader::system_fonts;
use sensor_core::{
    DisplayConfig, ElementType, PrepareTextData, SensorValue, TextConfig, TransportMessage,
    TransportType,
};

/// Creates the PrepareTextData struct which contains the font data for each text element.
pub fn get_preparation_data(display_config: &DisplayConfig) -> PrepareTextData {
    PrepareTextData {
        font_data: build_fonts_data(display_config),
    }
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

/// Builds the font data hashmap for all text elements.
pub fn build_fonts_data(display_config: &DisplayConfig) -> HashMap<String, Vec<u8>> {
    display_config
        .elements
        .iter()
        .filter(|element| element.element_type == ElementType::Text)
        .map(|text_element| {
            let text_config = text_element.text_config.as_ref().unwrap();
            let font_family_name = &text_config.font_family;
            let font_family = system_fonts::FontPropertyBuilder::new()
                .family(font_family_name)
                .build();
            let font_data = system_fonts::get(&font_family).unwrap().0;
            (font_family_name.clone(), font_data)
        })
        .collect()
}
