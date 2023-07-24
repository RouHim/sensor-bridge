/// Pretty print bytes, e.g. 534 MB
/// Returns a tuple of (value, unit)
pub fn pretty_bytes(value: usize) -> (f64, String) {
    let mut value = value as f64;
    let mut unit = 0;
    let units = vec!["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    while value > 1024f64 {
        value /= 1024f64;
        unit += 1;
    }

    (value, units[unit].to_string())
}
