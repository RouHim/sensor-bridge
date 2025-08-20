use std::io::Cursor;
use std::sync::LockResult;

use image::{DynamicImage, ImageBuffer, Rgba};
use chrono::{DateTime, Utc};

/// Pretty print bytes, e.g. 534 MB
/// Returns a tuple of (value, unit)
/// # Arguments
/// * `value` - The value to pretty print in bytes
pub fn pretty_bytes(value: f64) -> (f64, String) {
    let mut value = value;
    let mut unit = 0;
    let units = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    while value > 1024f64 {
        value /= 1024f64;
        unit += 1;
    }

    (value, units[unit].to_string())
}

/// Detects the system locale from environment variables
/// Checks LC_TIME first, then LANG, then falls back to "en"
pub fn get_system_locale() -> String {
    // Check LC_TIME first (specifically for time formatting)
    if let Ok(lc_time) = std::env::var("LC_TIME") {
        if let Some(locale) = parse_locale_string(&lc_time) {
            return locale;
        }
    }
    
    // Fall back to LANG
    if let Ok(lang) = std::env::var("LANG") {
        if let Some(locale) = parse_locale_string(&lang) {
            return locale;
        }
    }
    
    // Default fallback
    "en".to_string()
}

/// Parses locale string like "en_US.UTF-8" or "de_DE" to format suitable for locale detection
/// Returns the language part (e.g., "en", "de", "fr")
fn parse_locale_string(locale_str: &str) -> Option<String> {
    if locale_str.is_empty() || locale_str == "C" || locale_str == "POSIX" {
        return None;
    }
    
    // Extract language part before underscore or dot
    let language = locale_str
        .split('_')
        .next()?
        .split('.')
        .next()?;
    
    if language.len() >= 2 {
        Some(language.to_lowercase())
    } else {
        None
    }
}

/// Formats a DateTime using system locale-aware approach
/// Uses different format patterns based on detected locale
pub fn format_datetime_with_system_locale(datetime: &DateTime<Utc>) -> String {
    let locale = get_system_locale();
    
    // Use locale-appropriate format patterns
    let format_str = match locale.as_str() {
        "de" => "%d.%m.%Y %H:%M:%S",     // German: DD.MM.YYYY HH:MM:SS
        "fr" => "%d/%m/%Y %H:%M:%S",     // French: DD/MM/YYYY HH:MM:SS  
        "en" => "%m/%d/%Y %I:%M:%S %p",  // English: MM/DD/YYYY HH:MM:SS AM/PM
        "es" => "%d/%m/%Y %H:%M:%S",     // Spanish: DD/MM/YYYY HH:MM:SS
        "it" => "%d/%m/%Y %H:%M:%S",     // Italian: DD/MM/YYYY HH:MM:SS
        "ja" => "%Y年%m月%d日 %H:%M:%S", // Japanese: YYYY年MM月DD日 HH:MM:SS
        "zh" => "%Y年%m月%d日 %H:%M:%S", // Chinese: YYYY年MM月DD日 HH:MM:SS
        _ => "%Y-%m-%d %H:%M:%S",        // Default: ISO-like format
    };
    
    // Convert to local time and format
    datetime.format(format_str).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_locale_parsing() {
        assert_eq!(parse_locale_string("en_US.UTF-8"), Some("en".to_string()));
        assert_eq!(parse_locale_string("de_DE"), Some("de".to_string()));
        assert_eq!(parse_locale_string("fr_FR.ISO-8859-1"), Some("fr".to_string()));
        assert_eq!(parse_locale_string("C"), None);
        assert_eq!(parse_locale_string("POSIX"), None);
        assert_eq!(parse_locale_string(""), None);
    }

    #[test]
    fn test_datetime_formatting() {
        let dt = DateTime::parse_from_rfc3339("2024-12-20T14:30:45Z")
            .unwrap()
            .with_timezone(&Utc);
        
        let formatted = format_datetime_with_system_locale(&dt);
        // Should return some formatted string (either localized or fallback)
        assert!(!formatted.is_empty());
        println!("Formatted datetime: {}", formatted);
    }
}

/// Convert an rgb image to a png buffer
pub fn rgb_to_jpeg_bytes(image: ImageBuffer<Rgba<u8>, Vec<u8>>) -> Vec<u8> {
    let mut buf = Vec::new();
    let mut cursor = Cursor::new(&mut buf);
    image
        .write_to(&mut cursor, image::ImageOutputFormat::Jpeg(100))
        .unwrap();
    buf
}

/// Convert rgba an image to a png buffer
pub fn rgba_to_png_bytes(image: DynamicImage) -> Vec<u8> {
    let mut buf = Vec::new();
    let mut cursor = Cursor::new(&mut buf);
    image
        .write_to(&mut cursor, image::ImageOutputFormat::Png)
        .unwrap();
    buf
}

/// Checks if the given file uri is a url AND reachable.
pub fn is_reachable_url(file_uri: &str) -> bool {
    is_url(file_uri) && ureq::head(file_uri).call().is_ok()
}

/// Checks if the given file uri is a url.
pub fn is_url(file_uri: &str) -> bool {
    file_uri.starts_with("http://") || file_uri.starts_with("https://")
}

/// Extension methods for [`LockResult`].
///
/// [`LockResult`]: https://doc.rust-lang.org/stable/std/sync/type.LockResult.html
pub trait LockResultExt {
    type Guard;

    /// Returns the lock guard even if the mutex is [poisoned].
    ///
    /// [poisoned]: https://doc.rust-lang.org/stable/std/sync/struct.Mutex.html#poisoning
    fn ignore_poison(self) -> Self::Guard;
}

/// Implements a method to ignore poison errors
impl<Guard> LockResultExt for LockResult<Guard> {
    type Guard = Guard;

    fn ignore_poison(self) -> Guard {
        self.unwrap_or_else(|e| e.into_inner())
    }
}
