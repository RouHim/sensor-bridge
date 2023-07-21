use crate::sensor;
use rayon::prelude::*;
use std::collections::HashMap;

use sensor_core::SensorValue;
use std::thread;
use std::time::Duration;
use systemstat::platform::PlatformImpl;
use systemstat::IpAddr::{V4, V6};
use systemstat::{Platform, System};

pub struct SystemStatSensor {}

impl sensor::SensorProvider for SystemStatSensor {
    fn get_name(&self) -> String {
        "SystemStat".to_string()
    }
}

pub fn get_sensor_values() -> Vec<SensorValue> {
    let system_stat = System::new();

    let sensors_requests = vec![
        get_total_delayed_sensors,
        get_cpu_temp_sensors,
        get_memory_sensors,
        get_uptime_sensor,
        get_network_sensors,
        #[cfg(target_os = "linux")]
        get_disk_rw_sensors,
    ];

    sensors_requests
        .par_iter()
        .flat_map(|f| f(&system_stat))
        .collect()
}

fn get_network_sensors(system_stat: &PlatformImpl) -> Vec<SensorValue> {
    let network = system_stat.networks().unwrap();

    let mut sensor_values: Vec<SensorValue> = vec![];

    // Hashmap that stores the rx and tx bytes for each network interface
    let mut network_bytes: HashMap<String, (u64, u64)> = HashMap::new();

    for (iface_name, iface_data) in &network {
        let net_data = system_stat.network_stats(&iface_name);
        if net_data.is_err() {
            continue;
        }

        let net_data = net_data.unwrap();

        // Read RX and TX in megabytes
        let rx = net_data.rx_bytes.0;
        let tx = net_data.tx_bytes.0;

        // Insert to hashmap
        network_bytes.insert(iface_name.clone(), (rx, tx));

        let first_addr = iface_data.addrs.first();
        if let Some(addr) = first_addr {
            let net_address = &addr.addr;

            // Check if net_address is V4 or V6
            if let V4(ipv4) = net_address {
                sensor_values.push(SensorValue {
                    id: format!("network_ip_{}", iface_name),
                    value: ipv4.to_string(),
                    unit: "".to_string(),
                    label: format!("{} IP", iface_name),
                    sensor_type: "text".to_string(),
                });
            } else if let V6(ipv6) = net_address {
                sensor_values.push(SensorValue {
                    id: format!("network_ip_{}", iface_name),
                    value: ipv6.to_string(),
                    unit: "".to_string(),
                    label: format!("{} IP", iface_name),
                    sensor_type: "text".to_string(),
                });
            }
        }
    }

    // Wait 250ms
    thread::sleep(Duration::from_millis(250));

    // Read RX and TX again
    for (iface_name, _iface_data) in network {
        let net_data = system_stat.network_stats(&iface_name);
        if net_data.is_err() {
            continue;
        }

        let net_data = net_data.unwrap();

        // Read RX and TX in megabytes
        let rx = net_data.rx_bytes.0;
        let tx = net_data.tx_bytes.0;

        // Get previous RX and TX from hashmap
        let (prev_rx, prev_tx) = network_bytes.get(&iface_name).unwrap();

        // Calculate RX and TX in bytes
        // Cause we only waited 250ms, we need to multiply by 4 to get the correct value
        let rx_delta = (rx - prev_rx) * 4;
        let tx_delta = (tx - prev_tx) * 4;

        let (dl_rate, dl_rate_format) = pretty_bytes(rx_delta as usize);
        let (ul_rate, ul_rate_format) = pretty_bytes(tx_delta as usize);

        // Add RX and TX to the vector
        sensor_values.push(SensorValue {
            id: format!("network_rx_{iface_name}"),
            value: format!("{:.2}", dl_rate),
            unit: format!("{dl_rate_format}/s"),
            label: format!("{iface_name} download rate"),
            sensor_type: "number".to_string(),
        });

        sensor_values.push(SensorValue {
            id: format!("network_tx_{iface_name}"),
            value: format!("{:.2}", ul_rate),
            unit: format!("{ul_rate_format}/s"),
            label: format!("{iface_name} upload rate"),
            sensor_type: "number".to_string(),
        });
    }

    sensor_values
}

fn get_total_delayed_sensors(system_stat: &PlatformImpl) -> Vec<SensorValue> {
    let cpu_load = system_stat.cpu_load_aggregate().unwrap();
    let per_cpu_load = system_stat.cpu_load().unwrap();

    thread::sleep(Duration::from_millis(250));

    let cpu = cpu_load.done().unwrap();
    let cpus = per_cpu_load.done().unwrap();

    let total_cpu_load =
        cpu.user * 100.0 + cpu.nice * 100.0 + cpu.system * 100.0 + cpu.interrupt * 100.0;

    // Collect CPU load for each CPU
    let mut sensor_values: Vec<SensorValue> = cpus
        .into_iter()
        .enumerate()
        .map(|(i, cpu)| {
            let total_cpu_load =
                cpu.user * 100.0 + cpu.nice * 100.0 + cpu.system * 100.0 + cpu.interrupt * 100.0;
            SensorValue {
                id: format!("cpu_load_{}", i),
                value: format!("{:.2}", total_cpu_load),
                label: format!("CPU {} load", i),
                unit: "%".to_string(),
                sensor_type: "percentage".to_string(),
            }
        })
        .collect();

    // Add total CPU load to the vector
    sensor_values.push(SensorValue {
        id: "cpu_load_total".to_string(),
        value: format!("{:.2}", total_cpu_load),
        unit: "%".to_string(),
        label: "Total CPU load".to_string(),
        sensor_type: "percentage".to_string(),
    });

    sensor_values
}

fn get_cpu_temp_sensors(system_stat: &PlatformImpl) -> Vec<SensorValue> {
    let cpu_temp = system_stat.cpu_temp();

    if cpu_temp.is_err() {
        return vec![];
    }

    vec![SensorValue {
        id: "cpu_temp_package".to_string(),
        value: format!("{:.2}", cpu_temp.unwrap()),
        label: "CPU package temperature".to_string(),
        unit: "°C".to_string(),
        sensor_type: "temperature".to_string(),
    }]
}

fn get_uptime_sensor(system_stat: &PlatformImpl) -> Vec<SensorValue> {
    let uptime = system_stat.uptime();

    if uptime.is_err() {
        return vec![];
    }

    let uptime = uptime.unwrap();

    // Format as hh:mm:ss
    vec![SensorValue {
        id: "system_uptime".to_string(),
        value: format!(
            "{:02}:{:02}:{:02}",
            uptime.as_secs() / 3600,
            (uptime.as_secs() % 3600) / 60,
            uptime.as_secs() % 60
        ),
        label: "System uptime".to_string(),
        unit: "".to_string(),
        sensor_type: "text".to_string(),
    }]
}

// Reads in mega bytes
fn get_memory_sensors(system_stat: &PlatformImpl) -> Vec<SensorValue> {
    let mem = system_stat.memory();

    if mem.is_err() {
        return vec![];
    }

    let mem = mem.unwrap();

    let mem_total = mem.total.as_u64();
    let mem_free = mem.free.as_u64();
    let mem_used = mem_total - mem_free;

    let (mem_total, mem_total_unit) = pretty_bytes(mem_total as usize);
    let (mem_used, mem_used_unit) = pretty_bytes(mem_used as usize);
    let (mem_free, mem_free_unit) = pretty_bytes(mem_free as usize);

    // Collect sensors and use pretty_bytes to convert the values
    vec![
        SensorValue {
            id: "memory_total".to_string(),
            value: format!("{:.2}", mem_total),
            label: "Total memory".to_string(),
            unit: mem_total_unit,
            sensor_type: "number".to_string(),
        },
        SensorValue {
            id: "memory_used".to_string(),
            value: format!("{:.2}", mem_used),
            label: "Used memory".to_string(),
            unit: mem_used_unit,
            sensor_type: "number".to_string(),
        },
        SensorValue {
            id: "memory_free".to_string(),
            value: format!("{:.2}", mem_free),
            label: "Free memory".to_string(),
            unit: mem_free_unit,
            sensor_type: "number".to_string(),
        },
        SensorValue {
            id: "memory_used_percentage".to_string(),
            value: format!("{:.2}", mem_used as f64 / mem_total as f64 * 100.0),
            label: "Used memory percentage".to_string(),
            unit: "%".to_string(),
            sensor_type: "percentage".to_string(),
        },
    ]
}

#[cfg(target_os = "linux")]
fn get_disk_rw_sensors(system_stat: &PlatformImpl) -> Vec<SensorValue> {
    let disks = system_stat.block_device_statistics();

    if disks.is_err() {
        return vec![];
    };

    let disks = disks.unwrap();

    // Snapshot read_ios and write_ios per disk
    let mut read_ios: HashMap<String, usize> = HashMap::new();
    let mut write_ios: HashMap<String, usize> = HashMap::new();
    disks.iter().for_each(|disk| {
        read_ios.insert(disk.1.name.clone(), disk.1.read_sectors);
        write_ios.insert(disk.1.name.clone(), disk.1.write_sectors);
    });

    thread::sleep(Duration::from_millis(250));

    let disks = system_stat.block_device_statistics().unwrap();

    // Calculate read and write per second per disk
    disks
        .into_iter()
        .flat_map(|disk| {
            let sector_size = get_sector_size(&disk.1.name);

            // Calculate read and write per second per disk based on the difference between
            // the current and previous sector count
            // To compensate the 250ms sleep not 1 second, multiply by 4
            let read =
                (disk.1.read_sectors - read_ios.get(&disk.1.name).unwrap()) * sector_size * 4;
            let write =
                (disk.1.write_sectors - write_ios.get(&disk.1.name).unwrap()) * sector_size * 4;

            let (read, read_unit) = pretty_bytes(read);
            let (write, write_unit) = pretty_bytes(write);

            vec![
                SensorValue {
                    id: format!("disk_read_{}", disk.1.name),
                    value: format!("{:.2}", read),
                    label: format!("Disk {} read", disk.1.name),
                    unit: format!("{}/s", read_unit),
                    sensor_type: "number".to_string(),
                },
                SensorValue {
                    id: format!("disk_write_{}", disk.1.name),
                    value: format!("{:.2}", write),
                    label: format!("Disk {} write", disk.1.name),
                    unit: format!("{}/s", write_unit),
                    sensor_type: "number".to_string(),
                },
            ]
        })
        .collect()
}

/// Returns the sector size of the given device
/// This is needed to calculate the read and write per second
/// The sector size is read from /sys/block/{dev}/queue/hw_sector_size, thus this is only
/// supported on Linux
#[cfg(target_os = "linux")]
fn get_sector_size(dev: &str) -> usize {
    let file_path = format!("/sys/block/{dev}/queue/hw_sector_size");
    let file = File::open(file_path);
    if file.is_err() {
        return 512;
    }
    let mut reader = BufReader::new(file.unwrap());
    let mut line = String::new();
    reader.read_line(&mut line).unwrap();
    line.trim().parse::<usize>().unwrap()
}

/// Pretty print bytes, e.g. 534 MB
/// Returns a tuple of (value, unit)
fn pretty_bytes(value: usize) -> (f64, String) {
    let mut value = value as f64;
    let mut unit = 0;
    let units = vec!["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    while value > 1024f64 {
        value /= 1024f64;
        unit += 1;
    }

    (value, units[unit].to_string())
}
