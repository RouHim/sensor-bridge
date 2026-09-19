#[cfg(target_os = "linux")]
use std::fs;

use font_loader::system_fonts;

/// Loads system font data by font family name.
/// Returns an error instead of panicking when the font cannot be loaded.
///
/// The installed families are checked up front because fontconfig silently
/// substitutes a default font for an unknown family: `system_fonts::get` would
/// hand out Noto Sans for a typo, which is exactly the degraded payload this
/// must not produce.
pub fn try_load_data(font_family_name: &str) -> Result<Vec<u8>, String> {
    if !exists(font_family_name) {
        return Err(format!("Failed to load font '{}'", font_family_name));
    }

    let property = system_fonts::FontPropertyBuilder::new()
        .family(font_family_name)
        .build();

    match system_fonts::get(&property) {
        Some(font) => Ok(font.0),
        None => Err(format!("Failed to load font '{}'", font_family_name)),
    }
}

/// Loads a system font data by its font family name.
///
/// This is the permissive loader for the preview and export paths: when the
/// family is not installed, fontconfig substitutes a default font instead of
/// failing. Payload preparation must not use it; it uses [`try_load_data`].
pub fn load_data(font_family_name: &str) -> Vec<u8> {
    let property = system_fonts::FontPropertyBuilder::new()
        .family(font_family_name)
        .build();
    let font = system_fonts::get(&property).unwrap();
    font.0
}

/// Checks if the given font family name is installed on the system.
/// Note: uses query_all instead of query_specific to work around
/// rust-font-loader doing slice::from_raw_parts(NULL, 0) when no font
/// matches, which aborts on Rust >= 1.98 UB precondition checks.
pub fn exists(font_family_name: &str) -> bool {
    system_fonts::query_all()
        .iter()
        .any(|font| font == font_family_name)
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
    fs::create_dir_all(&font_dir).unwrap_or_default();

    // Install font file
    fs::write(font_file_path, font_data).unwrap();

    // Run sc-cache to update the font cache
    let _ = std::process::Command::new("fc-cache")
        .arg("--force")
        .arg("--really-force")
        .output();
}
