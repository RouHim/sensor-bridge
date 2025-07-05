use std::collections::HashMap;
use std::fs;
use std::io::Cursor;
use std::path::PathBuf;

use crate::utils;
use image::ImageFormat;
use rayon::prelude::*;
use sensor_core::{is_image, ConditionalImageConfig, DisplayConfig, ElementConfig, ElementType};
use serde::{Deserialize, Serialize};

const REPO_METADATA_URL: &str =
    "https://raw.githubusercontent.com/RouHim/sensor-asset-catalog/main/content.json";

/// Unpacks the zip file to the .cache folder of the system for the current sensor_id.
/// Cleans up the folder after unpacking.
/// Resizes the images to the desired size.
/// Encodes the images to png.
/// Returns the path to the unpacked folder.
/// # Arguments
/// * `element_id` - The id of the element
/// * `conditional_image_config` - The conditional image config
pub fn prepare_element(
    element_id: &str,
    conditional_image_config: &ConditionalImageConfig,
) -> String {
    // Determine paths
    let zip_file_path = &conditional_image_config.images_path;
    let cache_folder_path = sensor_core::get_cache_dir(element_id, &ElementType::ConditionalImage);

    // Ensure that the cache folder exists and is empty
    fs::remove_dir_all(&cache_folder_path).unwrap_or_default();
    fs::create_dir_all(&cache_folder_path).unwrap();

    // Unzip to cache folder
    let zip_file_data = if utils::is_reachable_url(zip_file_path) {
        let mut zip_data = vec![];
        ureq::get(zip_file_path)
            .call()
            .unwrap()
            .into_reader()
            .read_to_end(&mut zip_data)
            .unwrap();
        zip_data
    } else {
        fs::read(zip_file_path).unwrap()
    };

    zip_extract::extract(Cursor::new(zip_file_data), &cache_folder_path, true).unwrap();

    // Make sure that the cache folder path only contains supported images
    // First index all supported image paths
    let sensor_value_images: Vec<String> = find_recursive_in(&cache_folder_path);

    // Ensure that these images are in the root folder of cache_folder_path
    let sensor_value_images: Vec<String> = sensor_value_images
        .iter()
        .map(|image_path| {
            let path_buf = PathBuf::from(&image_path);
            let image_name = path_buf.file_name().unwrap();
            let new_image_path = cache_folder_path.join(image_name);
            fs::rename(image_path, &new_image_path).unwrap();
            new_image_path.to_str().unwrap().to_string()
        })
        .collect();

    // Delete everything else in the cache folder path
    for dir_entry in fs::read_dir(&cache_folder_path).unwrap().flatten() {
        let file_type = dir_entry.file_type().unwrap();

        if file_type.is_dir() {
            let dir_path = dir_entry.path();
            fs::remove_dir_all(&dir_path).unwrap();
        } else if file_type.is_file() {
            let file_path = dir_entry.path();
            if !sensor_value_images.contains(&file_path.to_str().unwrap().to_string()) {
                fs::remove_file(&file_path).unwrap();
            }
        }
    }

    // Resize the image to the desired size
    // Encode the image to png and save it as such and adjust file name extension to .png
    // Remove the old image (if it was not png)
    sensor_value_images.par_iter().for_each(|image_path| {
        // Read the image
        let image = image::open(image_path).unwrap();
        // Resize
        let image = image.resize_exact(
            conditional_image_config.width,
            conditional_image_config.height,
            image::imageops::FilterType::Lanczos3,
        );
        // Set the extension to png
        let old_image_path = PathBuf::from(&image_path);
        let new_image_path = old_image_path.with_extension("png");

        // Encode the image to png
        image
            .save_with_format(&new_image_path, ImageFormat::Png)
            .unwrap();

        // Remove the old image only if the name is not the same
        let new_image_file_name = new_image_path.file_name().unwrap().to_str().unwrap();
        let old_image_file_name = old_image_path.file_name().unwrap().to_str().unwrap();
        if new_image_file_name != old_image_file_name {
            fs::remove_file(image_path).unwrap();
        }
    });

    // Return path to cache folder
    cache_folder_path.to_str().unwrap().to_string()
}

/// Finds all images in the given folder and its subfolders.
fn find_recursive_in(search_folder: &PathBuf) -> Vec<String> {
    let mut found_files: Vec<String> = vec![];

    for folder_entry in fs::read_dir(search_folder).unwrap() {
        // Check if the folder is ok
        if folder_entry.is_err() {
            continue;
        }

        let folder_entry = folder_entry.unwrap();
        let file_type = folder_entry.file_type();

        // Check if the file type is ok
        if file_type.is_err() {
            continue;
        }
        let file_type = file_type.unwrap();

        if file_type.is_file() && is_image(&folder_entry) {
            found_files.push(folder_entry.path().to_str().unwrap().to_string());
        } else if file_type.is_dir() {
            found_files.extend(find_recursive_in(&folder_entry.path()));
        }
    }

    found_files
}

/// Pre-renders conditional images and returns the data to send.
pub fn get_preparation_data(
    lcd_config: &DisplayConfig,
) -> HashMap<String, HashMap<String, Vec<u8>>> {
    let conditional_image_elements: Vec<&ElementConfig> = lcd_config
        .elements
        .iter()
        .filter(|element| element.element_type == ElementType::ConditionalImage)
        .collect();

    // Unpack archive to cache folder
    conditional_image_elements.par_iter().for_each(|element| {
        prepare_element(
            &element.id,
            element.conditional_image_config.as_ref().unwrap(),
        );
    });

    // Pre-process / Pre-render and prepare for display transport
    let images_data: HashMap<String, HashMap<String, Vec<u8>>> = conditional_image_elements
        .par_iter()
        .map(|element| (element.id.clone(), get_image_series(&element.id)))
        .collect();

    images_data
}

/// Collects conditional image data for the specified element.
/// Returns a hashmap with the image name as key and the image data as value.
fn get_image_series(element_id: &str) -> HashMap<String, Vec<u8>> {
    let mut image_series: HashMap<String, Vec<u8>> = HashMap::new();

    let cache_dir = sensor_core::get_cache_dir(element_id, &ElementType::ConditionalImage);

    for image_path in fs::read_dir(cache_dir).unwrap() {
        let image_path = image_path.unwrap().path();
        let image_name = image_path
            .file_name()
            .unwrap()
            .to_str()
            .unwrap()
            .to_string();

        let image_data = fs::read(image_path).unwrap();
        image_series.insert(image_name, image_data);
    }

    image_series
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone)]
pub struct ConditionalImageRepoEntry {
    name: String,
    url: String,
    resolution: String,
}

/// Returns a list of all available conditional image repos.
pub fn get_repo_entries() -> Vec<ConditionalImageRepoEntry> {
    ureq::get(REPO_METADATA_URL)
        .call()
        .unwrap()
        .into_json()
        .unwrap()
}
