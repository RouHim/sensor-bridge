use crate::config::ComPortConfig;

pub fn open(port_config: &ComPortConfig) {
    println!("Opening LCD preview for port {}", port_config.com_port);
}