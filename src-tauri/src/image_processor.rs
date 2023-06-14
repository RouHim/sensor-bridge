use std::fs::File;
use std::io::Write;
use base64::{Engine, engine};
use image::DynamicImage;

pub fn to_base64(image: DynamicImage) -> String {
    let bla = image.as_rgb8().unwrap().to_vec();
    let bytes = bla.as_slice();
    let base64 = base64::encode(bytes);
    println!("base64: {}", base64);


    // FIXME: this is broken
    // Save bytes to file out.jpg in downloads folder
    let mut file = File::create("/home/rouven/Downloads/out.jpg").unwrap();
    file.write_all(bytes).unwrap();

    return base64;
}