use std::fs;
use std::sync::{Arc, Mutex};

use dmidecode::{BaseBoard, Bios, EntryPoint, Structure};
use sensor_core::SensorValue;
use super_shell::RootShell;

pub struct DmiDecodeSensors {
    pub root_shell: Arc<Mutex<Option<RootShell>>>,
}

const DMIDECODE_DATA_PATH: &str = "/tmp/dmidecode.bin";

impl DmiDecodeSensors {
    pub fn new(root_shell_mutex: Arc<Mutex<Option<RootShell>>>) -> DmiDecodeSensors {
        DmiDecodeSensors {
            root_shell: root_shell_mutex,
        }
    }

    #[cfg(target_os = "linux")]
    pub fn get_sensor_values(&self) -> Vec<SensorValue> {
        // Measure time
        let mut root_shell = self.root_shell.lock().unwrap();
        let root_shell = root_shell.as_mut().unwrap();
        root_shell.execute(format!("rm -f {DMIDECODE_DATA_PATH}"));
        root_shell.execute(format!(
            "dmidecode --dump-bin {DMIDECODE_DATA_PATH} &>/dev/null"
        ));
        parse_sensor_values(fs::read(DMIDECODE_DATA_PATH).unwrap().as_slice())
    }

    #[cfg(target_os = "windows")]
    pub fn get_sensor_values(&self) -> Vec<SensorValue> {
        vec![]
    }
}

#[cfg(target_os = "linux")]
fn parse_sensor_values(dmidecode_data: &[u8]) -> Vec<SensorValue> {
    let entry_point = EntryPoint::search(dmidecode_data).unwrap();

    entry_point
        .structures(&dmidecode_data[(entry_point.smbios_address() as usize)..])
        .filter_map(|s| s.ok())
        .flat_map(|entry| match entry {
            Structure::MemoryDevice(memory_device) => parse_memory_device(memory_device),
            Structure::Bios(bios) => parse_bios(bios),
            Structure::BaseBoard(main_board) => parse_base_board(main_board),
            _ => vec![],
        })
        .collect()
}

#[cfg(target_os = "linux")]
fn parse_base_board(main_board: BaseBoard) -> Vec<SensorValue> {
    let manufacturer = main_board.manufacturer;
    let product_name = main_board.product;
    let version = main_board.version;

    vec![
        SensorValue {
            id: "main_board_manufacturer".to_string(),
            value: manufacturer.to_string(),
            unit: "".to_string(),
            label: "Mainboard Manufacturer".to_string(),
            sensor_type: "text".to_string(),
        },
        SensorValue {
            id: "main_board_product_name".to_string(),
            value: product_name.to_string(),
            unit: "".to_string(),
            label: "Mainboard Product Name".to_string(),
            sensor_type: "text".to_string(),
        },
        SensorValue {
            id: "main_board_version".to_string(),
            value: version.to_string(),
            unit: "".to_string(),
            label: "Mainboard Version".to_string(),
            sensor_type: "text".to_string(),
        },
    ]
}

#[cfg(target_os = "linux")]
fn parse_bios(bios: Bios) -> Vec<SensorValue> {
    let bios_vendor = bios.vendor;
    let bios_version = bios.bios_version;
    let bios_release_date = bios.bios_release_date;
    let bios_revision = bios
        .bios_revision
        .map(|x| x.to_string())
        .unwrap_or("".to_string());
    let firmware_revision = bios
        .firmware_revision
        .map(|x| x.to_string())
        .unwrap_or("".to_string());

    vec![
        SensorValue {
            id: "bios_vendor".to_string(),
            value: bios_vendor.to_string(),
            unit: "".to_string(),
            label: "BIOS Vendor".to_string(),
            sensor_type: "text".to_string(),
        },
        SensorValue {
            id: "bios_version".to_string(),
            value: bios_version.to_string(),
            unit: "".to_string(),
            label: "BIOS Version".to_string(),
            sensor_type: "text".to_string(),
        },
        SensorValue {
            id: "bios_release_date".to_string(),
            value: bios_release_date.to_string(),
            unit: "".to_string(),
            label: "BIOS Release Date".to_string(),
            sensor_type: "text".to_string(),
        },
        SensorValue {
            id: "bios_revision".to_string(),
            value: bios_revision,
            unit: "".to_string(),
            label: "BIOS Revision".to_string(),
            sensor_type: "text".to_string(),
        },
        SensorValue {
            id: "firmware_revision".to_string(),
            value: firmware_revision,
            unit: "".to_string(),
            label: "Firmware Revision".to_string(),
            sensor_type: "text".to_string(),
        },
    ]
}

#[cfg(target_os = "linux")]
fn parse_memory_device(memory_device: dmidecode::MemoryDevice) -> Vec<SensorValue> {
    let device_location = memory_device.device_locator;
    let memory_type = format!("{:?}", memory_device.memory_type).to_uppercase();
    let form_factor = format!("{:?}", memory_device.form_factor).to_uppercase();
    let memory_speed = memory_device
        .speed
        .map(|x| x.to_string().replace("MT/s", ""))
        .unwrap_or("0".to_string());
    let manufacturer = memory_device.manufacturer;
    let memory_voltage = memory_device.configured_voltage.unwrap_or(0) as f32 / 1000f32;
    let memory_part_number = memory_device.part_number.trim();

    vec![
        SensorValue {
            id: format!("memory_device_{device_location}_memory_type"),
            value: format!("{memory_type}-{memory_speed} {form_factor} "),
            unit: "".to_string(),
            label: format!("{manufacturer} {memory_part_number} {device_location} Memory type"),
            sensor_type: "text".to_string(),
        },
        SensorValue {
            id: format!("memory_device_{device_location}_memory_speed"),
            value: memory_speed.to_string(),
            unit: "".to_string(),
            label: format!("{manufacturer} {memory_part_number} {device_location} Memory speed"),
            sensor_type: "number".to_string(),
        },
        SensorValue {
            id: format!("memory_device_{device_location}_memory_voltage"),
            value: format!("{memory_voltage}"),
            unit: "V".to_string(),
            label: format!("{manufacturer} {memory_part_number} {device_location} Memory voltage"),
            sensor_type: "number".to_string(),
        },
    ]
}
