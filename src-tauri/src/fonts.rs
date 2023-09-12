#[cfg(target_os = "linux")]
use std::fs;

use font_loader::system_fonts;

/// Loads a system font data by its font family name.
pub fn load_data(font_family_name: &str) -> Vec<u8> {
    let property = system_fonts::FontPropertyBuilder::new()
        .family(font_family_name)
        .build();
    let font = system_fonts::get(&property).unwrap();
    font.0
}

/// Checks if the given font family name is installed on the system.
pub fn exists(font_family_name: &str) -> bool {
    let mut property = system_fonts::FontPropertyBuilder::new()
        .family(font_family_name)
        .build();
    let font = system_fonts::query_specific(&mut property);
    !font.is_empty()
}

/// Get all system fonts.
pub fn get_all() -> Vec<String> {
    system_fonts::query_all()
        .iter()
        .map(|font| font.to_string())
        .collect()
}

/// Installs the font to the system.
pub fn install_font(font_family_name: &str, font_data: &Vec<u8>) {
    // Check if font is already installed, then skip
    if exists(font_family_name) {
        return;
    }

    // Otherwise install the font to the system
    install_font_internal(font_family_name, font_data);
}

#[cfg(target_os = "linux")]
fn install_font_internal(font_family_name: &str, font_data: &Vec<u8>) {
    // Install to user local font directory
    let font_dir = dirs::font_dir().unwrap();
    let font_file_path = font_dir.join(font_family_name).with_extension("ttf");

    // Ensure font directory exists
    let _ = fs::create_dir_all(&font_dir);

    // Install font file
    fs::write(font_file_path, font_data).unwrap();

    // Run sc-cache to update the font cache
    let _ = std::process::Command::new("fc-cache")
        .arg("--force")
        .arg("--really-force")
        .output();
}

#[cfg(target_os = "windows")]
fn install_font_internal(font_family_name: &str, font_data: &Vec<u8>) {
    info!("Installing a font on windows is not supported.");
}
