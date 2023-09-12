use std::fs;

use sensor_core::ElementType;
use serde::{Deserialize, Serialize};
use serde_json::Error;

use crate::config::AppConfig;
use crate::{config, fonts, utils};

/// Exports the current configuration to the specified file.
pub fn export_configuration(file_path: String) {
    // Read the current config
    let mut app_config: AppConfig = config::read_from_app_config();

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
    for network_device in app_config.network_devices.values_mut() {
        for element in &mut network_device.display_config.elements {
            match element.element_type {
                ElementType::Text => {
                    // Inline font data
                    let text_config = element.text_config.as_mut().unwrap();
                    let font_family_name = &text_config.font_family;
                    let font_family_data: Vec<u8> = fonts::load_data(font_family_name);
                    let font_dto = FontDto {
                        name: font_family_name.to_string(),
                        data: font_family_data,
                    };
                    let font_family_json: String = serde_json::to_string(&font_dto).unwrap();
                    text_config.font_family = font_family_json;
                }
                ElementType::StaticImage => {
                    let img_config = element.image_config.as_mut().unwrap();
                    let file_path = &img_config.image_path;
                    let img_data = fs::read(file_path).unwrap();
                    let img_base64 = to_base64_string(img_data);
                    img_config.image_path = img_base64;
                }
                ElementType::Graph => {
                    // Nothing to inline
                }
                ElementType::ConditionalImage => {
                    let cond_image_config = element.conditional_image_config.as_mut().unwrap();
                    if utils::is_not_url(&cond_image_config.images_path) {
                        let img_data = fs::read(&cond_image_config.images_path).unwrap();
                        let img_base64 = to_base64_string(img_data);
                        cond_image_config.images_path = img_base64;
                    };
                }
            }
        }
    }
}

/// Imports the configuration from the specified file.
pub fn import_configuration(file_path: String) -> Result<AppConfig, Error> {
    let json_config = fs::read_to_string(file_path).unwrap();
    let mut app_config: AppConfig = serde_json::from_str(&json_config)?;

    // Cleanup the config dir (remove and crate)
    let _ = fs::remove_dir_all(sensor_core::get_config_dir());
    let _ = fs::create_dir_all(sensor_core::get_config_dir());

    for network_device in app_config.network_devices.values_mut() {
        for element in &mut network_device.display_config.elements {
            match element.element_type {
                ElementType::Text => {
                    let text_config = element.text_config.as_mut().unwrap();
                    let font_family = &text_config.font_family;
                    if is_json(font_family) {
                        let font_dto: FontDto = serde_json::from_str(font_family).unwrap();
                        fonts::install_font(&font_dto.name, &font_dto.data);
                        text_config.font_family = font_dto.name;
                    }
                }
                ElementType::StaticImage => {
                    let img_config = element.image_config.as_mut().unwrap();
                    let img_string = &img_config.image_path;
                    let img_data = from_base64_string(img_string.to_string());
                    if let Some(img_data) = img_data {
                        let img_file_path = sensor_core::get_config_dir()
                            .join("static-image")
                            .join(&element.id)
                            .with_extension("png");
                        let _ = fs::create_dir_all(img_file_path.parent().unwrap());
                        fs::write(&img_file_path, img_data).unwrap();
                        img_config.image_path = img_file_path.to_str().unwrap().to_string();
                    }
                }
                ElementType::Graph => {
                    // Nothing to unpack
                }
                ElementType::ConditionalImage => {
                    let cond_image_config = element.conditional_image_config.as_mut().unwrap();
                    if utils::is_not_url(&cond_image_config.images_path) {
                        let img_base64 = &cond_image_config.images_path;
                        let img_data = from_base64_string(img_base64.to_string());
                        if let Some(img_data) = img_data {
                            let img_file_path = sensor_core::get_config_dir()
                                .join("conditional-image")
                                .join(&element.id)
                                .with_extension("png");
                            let _ = fs::create_dir_all(img_file_path.parent().unwrap());
                            fs::write(&img_file_path, img_data).unwrap();
                            cond_image_config.images_path =
                                img_file_path.to_str().unwrap().to_string();
                        }
                    };
                }
            }
        }
    }

    Ok(app_config)
}

/// Checks if the given string is a valid json.
fn is_json(some_string: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(some_string).is_ok()
}

/// Converts a byte vector to a base64 encoded string.
fn to_base64_string(data: Vec<u8>) -> String {
    let engine = base64::engine::general_purpose::STANDARD;
    base64::Engine::encode(&engine, data)
}

/// Converts a given base64 string to a byte vector.
fn from_base64_string(base64_string: String) -> Option<Vec<u8>> {
    let engine = base64::engine::general_purpose::STANDARD;
    base64::Engine::decode(&engine, base64_string).ok()
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
struct FontDto {
    name: String,
    data: Vec<u8>,
}
