use crate::sensor;
use rayon::prelude::*;

use sensor_core::SensorValue;
use std::thread;
use std::time::Duration;
use systemstat::platform::PlatformImpl;
use systemstat::{IpAddr, Platform, System};
use systemstat::IpAddr::{V4, V6};

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
    let mut network_bytes: std::collections::HashMap<String, (u64, u64)> = std::collections::HashMap::new();

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
    for (iface_name, iface_data) in network {
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

        // Calculate RX and TX in megabytes
        let mut rx_delta = (rx - prev_rx) as f64 / 1024.0 / 1024.0;
        let mut tx_delta = (tx - prev_tx) as f64 / 1024.0 / 1024.0;

        // Cause we only waited 250ms, we need to multiply by 4 to get the correct value
        rx_delta *= 4.0;
        tx_delta *= 4.0;

        // Add RX and TX to the vector
        sensor_values.push(SensorValue {
            id: format!("network_rx_{}", iface_name),
            value: format!("{:.2}", rx_delta),
            unit: "MB/s".to_string(),
            label: format!("{} Downloadrate", iface_name),
            sensor_type: "number".to_string(),
        });

        sensor_values.push(SensorValue {
            id: format!("network_tx_{}", iface_name),
            value: format!("{:.2}", tx_delta),
            unit: "MB/s".to_string(),
            label: format!("{} Uploadrate", iface_name),
            sensor_type: "number".to_string(),
        });

        // Also add total RX and TX to the vector
        sensor_values.push(SensorValue {
            id: format!("network_rx_total"),
            value: format!("{:.2}", rx_delta),
            unit: "MB/s".to_string(),
            label: format!("Total Download"),
            sensor_type: "number".to_string(),
        });

        sensor_values.push(SensorValue {
            id: format!("network_tx_total"),
            value: format!("{:.2}", tx_delta),
            unit: "MB/s".to_string(),
            label: format!("Total Upload"),
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

    // Collect sensors in mega bytes
    vec![
        SensorValue {
            id: "memory_total".to_string(),
            value: format!("{:.0}", mem.total.as_u64() as f64 / 1024.0 / 1024.0),
            label: "Total memory".to_string(),
            unit: "MB".to_string(),
            sensor_type: "number".to_string(),
        },
        SensorValue {
            id: "memory_used".to_string(),
            value: format!("{:.0}", mem.total.as_u64() as f64 / 1024.0 / 1024.0 - mem.free.as_u64() as f64 / 1024.0 / 1024.0),
            label: "Used memory".to_string(),
            unit: "MB".to_string(),
            sensor_type: "number".to_string(),
        },
        SensorValue {
            id: "memory_free".to_string(),
            value: format!("{:.0}", mem.free.as_u64() as f64 / 1024.0 / 1024.0),
            label: "Free memory".to_string(),
            unit: "MB".to_string(),
            sensor_type: "number".to_string(),
        },
        SensorValue {
            id: "memory_used_percentage".to_string(),
            value: format!("{:.2}", (mem.total.as_u64() as f64 / 1024.0 / 1024.0 - mem.free.as_u64() as f64 / 1024.0 / 1024.0) / (mem.total.as_u64() as f64 / 1024.0 / 1024.0) * 100.0),
            label: "Used memory percentage".to_string(),
            unit: "%".to_string(),
            sensor_type: "percentage".to_string(),
        },
    ]
}
