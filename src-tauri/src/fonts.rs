#[cfg(target_os = "linux")]
use std::fs;
use std::sync::LazyLock;

use font_loader::system_fonts;

/// Loads system font data by font family name.
/// Returns an error instead of panicking when the font cannot be loaded.
///
/// fontconfig silently substitutes a default font for a family it cannot
/// resolve: `system_fonts::get` would hand out Noto Sans for a typo, which is
/// exactly the degraded payload this must not produce. Names fontconfig matches
/// to a real font - config aliases, secondary families, case/blank variants -
/// are accepted, because they render the requested font.
pub fn try_load_data(font_family_name: &str) -> Result<Vec<u8>, String> {
    load_installed_font(font_family_name)
        .ok_or_else(|| format!("Failed to load font '{}'", font_family_name))
}

/// Resolves the bytes of the font fontconfig matches for `font_family_name`, or
/// `None` when the match is only the default font substituted for a name
/// fontconfig cannot resolve.
///
/// The installed families are checked first (cheap, and the common case).
/// Everything else goes through fontconfig's matching, which resolves far more
/// names than [`exists`] lists - config aliases (`Arial` -> Liberation Sans),
/// secondary families (`DejaVu Sans Condensed`) and case/blank variants - so
/// rejecting whatever [`exists`] does not know would fail loadable
/// configurations. What fontconfig cannot resolve it answers with its default
/// font, so the bytes it hands out are compared against the bytes of a family
/// that cannot exist: equal bytes are that substitution, different bytes are a
/// real font. Exempt from that check are the generic families of
/// [`GENERIC_FAMILIES`], which fontconfig resolves to the configured default
/// font by design: there, the default font is the requested result and not a
/// substitution.
fn load_installed_font(font_family_name: &str) -> Option<Vec<u8>> {
    // An empty family - as is an all-space family, once canonicalized - matches
    // fontconfig's default font as well.
    if without_ascii_spaces(font_family_name).is_empty() {
        return None;
    }

    // Generics never appear in fontconfig's family list, so `exists` cannot tell
    // them from a typo; they must be accepted before the substitution check.
    if is_generic_family(font_family_name) {
        return load_bytes(font_family_name);
    }

    if exists(font_family_name) {
        return load_bytes(font_family_name);
    }

    let font = load_bytes(font_family_name)?;
    let substituted = UNKNOWN_FAMILY_FONT
        .as_ref()
        .is_some_and(|default_font| default_font.as_slice() == font.as_slice());

    if substituted {
        None
    } else {
        Some(font)
    }
}

/// Font family that cannot be installed: matching it yields the default font
/// fontconfig substitutes for every name it cannot resolve.
const UNKNOWN_FAMILY: &str = "__sensor_bridge_unknown_family__";

/// The bytes fontconfig substitutes for [`UNKNOWN_FAMILY`], resolved at most
/// once per process because the sentinel comparison runs for every text element
/// of the payload.
static UNKNOWN_FAMILY_FONT: LazyLock<Option<Vec<u8>>> =
    LazyLock::new(|| load_bytes(UNKNOWN_FAMILY));

/// Asks fontconfig for the font bytes matched for `font_family_name`. A name
/// fontconfig cannot resolve comes back as its default font, not as a failure.
fn load_bytes(font_family_name: &str) -> Option<Vec<u8>> {
    let property = system_fonts::FontPropertyBuilder::new()
        .family(font_family_name)
        .build();

    system_fonts::get(&property).map(|font| font.0)
}

/// Loads a system font data by its font family name.
///
/// This is the permissive loader for the preview and export paths: when the
/// family is not installed, fontconfig substitutes a default font instead of
/// failing. Payload preparation must not use it; it uses [`try_load_data`].
pub fn load_data(font_family_name: &str) -> Vec<u8> {
    load_bytes(font_family_name).unwrap()
}

/// The family names fontconfig resolves generically, by design, to the font
/// configured for them - on a default installation the very font it substitutes
/// for a name it cannot resolve. That is the generic families (`serif`,
/// `sans-serif`, `monospace`, `cursive`, `fantasy`, `system-ui`, `emoji`,
/// `math`) plus the alternate and deprecated spellings fontconfig's own
/// configuration rewrites to them (`sans serif`, `sans`, `system ui`, `mono`).
///
/// None of them is an installed family, so [`exists`] cannot know them, and the
/// bytes `system_fonts::get` returns for them equal the ones it returns for
/// [`UNKNOWN_FAMILY`]: without this list the substitution check in
/// [`load_installed_font`] would reject a name that renders exactly what it
/// asks for.
const GENERIC_FAMILIES: [&str; 12] = [
    "serif",
    "sans-serif",
    "monospace",
    "cursive",
    "fantasy",
    "system-ui",
    "emoji",
    "math",
    "sans serif",
    "sans",
    "system ui",
    "mono",
];

/// Whether `font_family_name` names one of fontconfig's generic families
/// ([`GENERIC_FAMILIES`]), compared the way fontconfig compares families: case
/// insensitively and ignoring ASCII spaces.
fn is_generic_family(font_family_name: &str) -> bool {
    let family = without_ascii_spaces(font_family_name);

    GENERIC_FAMILIES
        .iter()
        .any(|generic| without_ascii_spaces(generic).eq_ignore_ascii_case(&family))
}

/// Checks if the given font family name is installed on the system.
///
/// Matches case-insensitively and ignoring ASCII spaces, because fontconfig's
/// family matching - the one `system_fonts::get` uses - ignores both: a family
/// configured as `dejavu sans` or `DejaVuSans` loads the installed
/// `DejaVu Sans`, so rejecting it here would fail an otherwise loadable
/// configuration. Only the ASCII space is ignored, exactly as fontconfig's
/// `FcStrCmpIgnoreBlanksAndCase` does; every other whitespace character makes
/// the name one fontconfig cannot resolve, so it must not be dropped here -
/// otherwise this would report a family fontconfig actually substitutes for as
/// installed, and the caller's fast path would skip the substitution check.
/// Unknown families are still rejected.
///
/// Note: uses query_all instead of query_specific to work around
/// rust-font-loader doing slice::from_raw_parts(NULL, 0) when no font
/// matches, which aborts on Rust >= 1.98 UB precondition checks.
pub fn exists(font_family_name: &str) -> bool {
    let family = without_ascii_spaces(font_family_name);

    system_fonts::query_all()
        .iter()
        .any(|font| without_ascii_spaces(font).eq_ignore_ascii_case(&family))
}

/// Drops the ASCII spaces from a font family name, mirroring fontconfig's
/// family matching, which ignores the ASCII space as well as case
/// (`DejaVuSans` resolves to the installed `DejaVu Sans`).
///
/// Only the ASCII space is dropped: fontconfig ignores no other whitespace, so
/// a name carrying a no-break space, a tab or a newline is a name it cannot
/// resolve - dropping those here would make this canonicalization disagree with
/// fontconfig about which families exist.
fn without_ascii_spaces(font_family_name: &str) -> String {
    font_family_name.chars().filter(|c| *c != ' ').collect()
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
