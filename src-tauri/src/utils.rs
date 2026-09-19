use std::io::Cursor;
use std::sync::{MutexGuard, PoisonError, RwLockReadGuard, RwLockWriteGuard};

use image::{DynamicImage, ImageBuffer, Rgba};

/// Recovers a lock guard from a poisoned lock instead of panicking.
/// The guarded data is plain state that must survive a panicking consumer.
pub trait LockResultExt<T> {
    fn ignore_poison(self) -> T;
}

impl<'a, T: ?Sized> LockResultExt<MutexGuard<'a, T>>
    for Result<MutexGuard<'a, T>, PoisonError<MutexGuard<'a, T>>>
{
    fn ignore_poison(self) -> MutexGuard<'a, T> {
        self.unwrap_or_else(PoisonError::into_inner)
    }
}

impl<'a, T: ?Sized> LockResultExt<RwLockReadGuard<'a, T>>
    for Result<RwLockReadGuard<'a, T>, PoisonError<RwLockReadGuard<'a, T>>>
{
    fn ignore_poison(self) -> RwLockReadGuard<'a, T> {
        self.unwrap_or_else(PoisonError::into_inner)
    }
}

impl<'a, T: ?Sized> LockResultExt<RwLockWriteGuard<'a, T>>
    for Result<RwLockWriteGuard<'a, T>, PoisonError<RwLockWriteGuard<'a, T>>>
{
    fn ignore_poison(self) -> RwLockWriteGuard<'a, T> {
        self.unwrap_or_else(PoisonError::into_inner)
    }
}

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
