use std::collections::VecDeque;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::{Arc, RwLock};
use std::thread;
use std::time::{Duration, Instant};

use log::{debug, error};
use sensor_core::SensorValue;
use super_shell::RootShell;

use crate::linux_dmidecode_sensors::DmiDecodeSensors;
use crate::system_stat_sensor;
use crate::utils::LockResultExt;
use crate::{
    linux_amdgpu, linux_lm_sensors, linux_system_sensors, misc_sensor, SENSOR_VALUE_HISTORY_SIZE,
};

/// Fixed sampling cadence: exactly one full measurement pass per second.
pub const SAMPLE_INTERVAL: Duration = Duration::from_secs(1);

/// The newest complete measurement. Every consumer serves this snapshot.
#[derive(Debug, Clone)]
pub struct SensorSnapshot {
    pub values: Vec<SensorValue>,
}

/// Performs one full measurement pass (static + dynamic sensors), including all
/// blocking measurement windows (each sleeps 250 ms).
/// MUST only be called from the sampler thread.
pub fn measure(static_sensor_values: &[SensorValue]) -> Vec<SensorValue> {
    let start = Instant::now();

    let mut sensor_values: Vec<SensorValue> = static_sensor_values.to_vec();
    sensor_values.extend(read_dynamic_sensor_values());

    // Sort sensors by label
    sensor_values.sort_by(|a, b| a.label.cmp(&b.label));

    debug!("Reading all sensors took {:?}", start.elapsed());

    sensor_values
}

/// Appends a sample to the newest-first history and evicts the oldest entry
/// beyond the capacity. Append and evict are O(1).
pub fn append_sample(history: &mut VecDeque<Vec<SensorValue>>, sample: Vec<SensorValue>) {
    history.push_front(sample);
    while history.len() > SENSOR_VALUE_HISTORY_SIZE {
        history.pop_back();
    }
}

/// Starts the always-on sampler on its own thread.
///
/// The loop never terminates on its own. A panicking measurement pass is logged,
/// keeps the last good snapshot in place and appends no history entry. The
/// schedule is a fixed grid (`deadline += interval`), so slow passes cannot
/// accumulate drift.
pub fn start_sampler<F>(
    measure_pass: F,
    snapshot: Arc<RwLock<Option<SensorSnapshot>>>,
    history: Arc<RwLock<VecDeque<Vec<SensorValue>>>>,
    interval: Duration,
) -> thread::JoinHandle<()>
where
    F: Fn() -> Vec<SensorValue> + Send + 'static,
{
    thread::Builder::new()
        .name("sensor-sampler".to_string())
        .spawn(move || {
            let mut deadline = Instant::now();
            loop {
                match catch_unwind(AssertUnwindSafe(&measure_pass)) {
                    Ok(values) => {
                        *snapshot.write().ignore_poison() = Some(SensorSnapshot {
                            values: values.clone(),
                        });
                        append_sample(&mut history.write().ignore_poison(), values);
                    }
                    Err(_) => error!("Sensor measurement pass failed; keeping last snapshot"),
                }

                deadline += interval;
                sensor_core::sleep_until(deadline);
            }
        })
        .expect("Failed to spawn sensor sampler thread")
}

/// Reads the static sensor values. This is done only once at startup.
pub fn read_static_sensor_values(
    root_shell_mutex: &Arc<RwLock<Option<RootShell>>>,
) -> Vec<SensorValue> {
    DmiDecodeSensors::new(root_shell_mutex.clone()).get_sensor_values()
}

/// Reads the dynamic sensor values. Called once per sampler pass.
fn read_dynamic_sensor_values() -> Vec<SensorValue> {
    // Store reference to the get_sensor_values functions in a vector
    let sensor_requests = vec![
        system_stat_sensor::get_sensor_values,
        misc_sensor::get_sensor_values,
        linux_lm_sensors::get_sensor_values,
        linux_amdgpu::get_sensor_values,
        linux_system_sensors::get_sensor_values,
    ];

    sensor_requests
        .into_iter()
        .flat_map(|f| f())
        .collect::<Vec<SensorValue>>()
}

#[cfg(test)]
mod sampler_tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    #[test]
    fn append_sample_keeps_newest_first_and_bounded() {
        let mut history: VecDeque<Vec<SensorValue>> = VecDeque::new();
        for i in 0..(SENSOR_VALUE_HISTORY_SIZE + 5) {
            append_sample(
                &mut history,
                vec![SensorValue {
                    id: i.to_string(),
                    ..Default::default()
                }],
            );
        }

        assert_eq!(history.len(), SENSOR_VALUE_HISTORY_SIZE);
        // Newest entry is the last one pushed
        assert_eq!(
            history.front().unwrap()[0].id,
            (SENSOR_VALUE_HISTORY_SIZE + 4).to_string()
        );
        // Oldest entry got evicted
        assert_eq!(history.back().unwrap()[0].id, "5");
    }

    #[test]
    fn sampler_appends_one_history_entry_per_pass() {
        let snapshot = Arc::new(RwLock::new(None));
        let history = Arc::new(RwLock::new(VecDeque::new()));

        let _handle = start_sampler(
            Vec::new,
            snapshot.clone(),
            history.clone(),
            Duration::from_millis(50),
        );

        thread::sleep(Duration::from_millis(180));

        let len = history.read().ignore_poison().len();
        assert!(
            (3..=4).contains(&len),
            "expected 3-4 passes in 180ms, got {len}"
        );
        assert!(snapshot.read().ignore_poison().is_some());
    }

    #[test]
    fn sampler_keeps_last_snapshot_when_a_pass_panics() {
        let snapshot = Arc::new(RwLock::new(None));
        let history = Arc::new(RwLock::new(VecDeque::new()));
        let calls = Arc::new(AtomicUsize::new(0));
        let calls_in_pass = calls.clone();

        let _handle = start_sampler(
            move || {
                let call = calls_in_pass.fetch_add(1, Ordering::SeqCst);
                if call == 1 {
                    panic!("simulated sensor read failure");
                }
                vec![SensorValue {
                    id: format!("pass-{call}"),
                    ..Default::default()
                }]
            },
            snapshot.clone(),
            history.clone(),
            Duration::from_millis(30),
        );

        thread::sleep(Duration::from_millis(160));

        let snapshot = snapshot
            .read()
            .ignore_poison()
            .clone()
            .expect("snapshot must exist");
        assert_ne!(
            snapshot.values[0].id, "pass-1",
            "a panicking pass must not replace the snapshot"
        );

        let history = history.read().ignore_poison();
        assert!(
            history.len() >= 2,
            "sampler must keep running after a panicking pass"
        );
        assert!(
            history.iter().all(|sample| sample[0].id != "pass-1"),
            "a panicking pass must not append a history entry"
        );
    }
}
