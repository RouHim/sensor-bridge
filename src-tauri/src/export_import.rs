use crate::config;
use crate::config::AppConfig;
use font_loader::system_fonts;
use sensor_core::ElementType;
use serde_json::Error;
use std::fs;

/// Exports the current configuration to the specified file.
pub fn export_configuration(file_path: String) {
    // Read the current config
    let mut app_config: AppConfig = config::read_from_app_config();

    // TODO: inline all file path as base64 encoded string
    inline_files(&mut app_config);

    // Serialize the config to a JSON string
    let json_config = serde_json::to_string_pretty(&app_config).unwrap();
    let file_path = if file_path.ends_with(".json") {
        file_path
    } else {
        format!("{}.json", file_path)
    };

    // Write the JSON string to the specified file
    fs::write(file_path, json_config).unwrap();
}

/// Inlines all files in the config as base64 encoded string.
fn inline_files(app_config: &mut AppConfig) {
    // Iterate over all network devices
    for (_, network_device) in &mut app_config.network_devices {
        // Iterate over all files
        for element in &mut network_device.display_config.elements {
            match element.element_type {
                ElementType::Text => {
                    // Inline font data
                    let text_config = element.text_config.as_mut().unwrap();
                    let font_family_name = &text_config.font_family;
                    let font_family_data: Vec<u8> = load_font_data(font_family_name);
                    let fond_family_base64: String = to_base64_string(font_family_data);
                    text_config.font_family = fond_family_base64;
                }
                ElementType::StaticImage => {
                    // TODO
                }
                ElementType::Graph => {
                    // TODO
                }
                ElementType::ConditionalImage => {
                    // TODO
                }
            }
        }
    }
}

/// Converts a byte vector to a base64 encoded string.
fn to_base64_string(data: Vec<u8>) -> String {
    let engine = base64::engine::general_purpose::STANDARD;
    base64::Engine::encode(&engine, data)
}

/// Loads a system font data by its font family name.
fn load_font_data(font_family_name: &str) -> Vec<u8> {
    let font_family = system_fonts::FontPropertyBuilder::new()
        .family(font_family_name)
        .build();
    system_fonts::get(&font_family).unwrap().0
}

/// Imports the configuration from the specified file.
pub fn import_configuration(file_path: String) -> Result<AppConfig, Error> {
    let json_config = fs::read_to_string(file_path).unwrap();

    // TODO: revert the file data inline

    let app_config: Result<AppConfig, serde_json::Error> = serde_json::from_str(&json_config);
    app_config
}
