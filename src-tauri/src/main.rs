#![cfg_attr(
all(not(debug_assertions), target_os = "windows"),
windows_subsystem = "windows"
)]

use crate::config::{ComPortConfig, OutputConfig};

mod aida64;
mod serial_port;
mod config;

#[tauri::command]
fn get_com_ports() -> Vec<String> {
    serial_port::list_ports().iter().map(|x| x.port_name.clone()).collect()
}

#[tauri::command]
fn get_sensor_values() -> String {
    let sensor_values = aida64::read_sensors();
    let string_sensor_values = serde_json::to_string(&sensor_values).unwrap();
    string_sensor_values
}

#[tauri::command]
fn load_port_config(com_port: String) -> String {
    let port_config: ComPortConfig = config::load_port_config(com_port);
    let string_config = serde_json::to_string(&port_config).unwrap();
    string_config
}

#[tauri::command]
fn add_output_address(com_port: String, address: String) {
    let mut port_config: ComPortConfig = config::load_port_config(com_port);
    port_config.output_config.insert(address.clone(), OutputConfig::default(&address));
    config::write_port_config(&port_config);
}

#[tauri::command]
fn delete_output_address(com_port: String, address: String) {
    let mut port_config: ComPortConfig = config::load_port_config(com_port);
    port_config.output_config.remove(&address);
    config::write_port_config(&port_config);
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_com_ports,
            get_sensor_values,
            load_port_config,
            add_output_address,
            delete_output_address,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
