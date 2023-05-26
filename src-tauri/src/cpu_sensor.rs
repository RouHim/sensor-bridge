use crate::sensor;
use crate::sensor::SensorValue;
use std::thread;
use std::time::Duration;
use systemstat::platform::PlatformImpl;
use systemstat::{Platform, System};

pub struct CpuSensor {}

impl sensor::SensorProvider for CpuSensor {
    fn get_name(&self) -> String {
        "CPU".to_string()
    }

    fn get_sensor_values(&self) -> Vec<SensorValue> {
        let mut sensors = vec![];

        let system_stat = System::new();

        // TODO: Request all sensors in parallel
        let bla = |system_stat| get_total_cpu_load(system_stat);

        sensors.push(bla(&system_stat));

        sensors
    }
}

fn get_total_cpu_load(system_stat: &PlatformImpl) -> SensorValue {
    let cpu_load = system_stat.cpu_load_aggregate().unwrap();
    thread::sleep(Duration::from_millis(250));
    let cpu = cpu_load.done().unwrap();
    let total_cpu_load =
        cpu.user * 100.0 + cpu.nice * 100.0 + cpu.system * 100.0 + cpu.interrupt * 100.0;

    SensorValue {
        id: "cpu_load_total".to_string(),
        value: format!("{:.2}%", total_cpu_load),
        label: "Total CPU load".to_string(),
        sensor_type: "percentage".to_string(),
    }
}
