use std::collections::HashMap;
use std::io::{BufWriter, Cursor};

use sensor_core::{DisplayConfig, ElementType, SensorValue, TextConfig};

use crate::fonts;

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
    let font_data = fonts::load_data(&text_config.font_family);
    let font = rusttype::Font::try_from_bytes(&font_data).unwrap();

    let text_image = sensor_core::text_renderer::render(
        image_width,
        image_height,
        text_config,
        &[vec![sensor_value.unwrap().clone()]],
        &font,
    );

    // Render to png
    let mut writer = BufWriter::new(Cursor::new(Vec::new()));
    text_image
        .write_to(&mut writer, image::ImageOutputFormat::Png)
        .unwrap();

    writer.into_inner().unwrap().into_inner()
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
            let font_data = fonts::load_data(font_family_name);
            (font_family_name.clone(), font_data)
        })
        .collect()
}
