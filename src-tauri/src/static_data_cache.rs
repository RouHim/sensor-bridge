use std::num::NonZeroUsize;
use std::sync::{Arc, Mutex};

use lru::LruCache;
use sensor_core::ElementConfig;

/// A prepared payload ready to be served to a client.
#[derive(Debug, Clone)]
pub struct PreparedStaticData {
    /// Revision identifier of the payload: stable while the elements are
    /// unchanged, different after any element edit.
    pub revision: String,
    /// Serialized static data (bincode-next).
    pub bytes: Arc<Vec<u8>>,
}

/// Shared handle to the cache.
pub type StaticDataCacheHandle = Arc<Mutex<StaticDataCache>>;

/// Enough entries for a handful of distinct display configurations while
/// keeping font/image blobs memory-bounded.
pub const STATIC_DATA_CACHE_CAPACITY: usize = 8;

/// Bounded cache of prepared static-data payloads, keyed by elements revision.
pub struct StaticDataCache {
    entries: LruCache<String, PreparedStaticData>,
}

impl StaticDataCache {
    pub fn new(capacity: usize) -> Self {
        Self {
            entries: LruCache::new(
                NonZeroUsize::new(capacity).expect("cache capacity must be greater than zero"),
            ),
        }
    }

    /// Returns the prepared payload for these elements, preparing it on first
    /// use. Preparation runs at most once per elements revision and failures
    /// are not cached.
    pub fn get_or_prepare<F>(
        &mut self,
        elements: &[ElementConfig],
        prepare: F,
    ) -> Result<PreparedStaticData, String>
    where
        F: FnOnce(&[ElementConfig]) -> Result<Vec<u8>, String>,
    {
        let revision = elements_revision(elements)?;

        if let Some(cached) = self.entries.get(&revision) {
            return Ok(cached.clone());
        }

        let bytes = prepare(elements)?;
        let prepared = PreparedStaticData {
            revision: revision.clone(),
            bytes: Arc::new(bytes),
        };
        self.entries.put(revision, prepared.clone());

        Ok(prepared)
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }
}

/// Revision identifier of an elements configuration: MD5 over its canonical
/// JSON form. Derived from the elements (not the serialized payload), so it is
/// stable across bridge restarts and changes exactly when the elements change.
pub fn elements_revision(elements: &[ElementConfig]) -> Result<String, String> {
    let json = serde_json::to_vec(elements)
        .map_err(|err| format!("Failed to serialize elements: {}", err))?;

    Ok(format!("{:x}", md5::compute(&json)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    fn text_element(id: &str) -> ElementConfig {
        ElementConfig {
            id: id.to_string(),
            ..Default::default()
        }
    }

    #[test]
    fn prepares_once_per_elements_revision() {
        let mut cache = StaticDataCache::new(STATIC_DATA_CACHE_CAPACITY);
        let calls = AtomicUsize::new(0);
        let elements = vec![text_element("a")];

        let first = cache
            .get_or_prepare(&elements, |_| {
                calls.fetch_add(1, Ordering::SeqCst);
                Ok(vec![1, 2, 3])
            })
            .unwrap();
        let second = cache
            .get_or_prepare(&elements, |_| {
                calls.fetch_add(1, Ordering::SeqCst);
                Ok(vec![9, 9])
            })
            .unwrap();

        assert_eq!(calls.load(Ordering::SeqCst), 1);
        assert_eq!(first.revision, second.revision);
        assert_eq!(*second.bytes, vec![1, 2, 3]);
    }

    #[test]
    fn identical_elements_of_two_clients_share_one_revision() {
        let mut cache = StaticDataCache::new(STATIC_DATA_CACHE_CAPACITY);
        let calls = AtomicUsize::new(0);
        let client_a = vec![text_element("a"), text_element("b")];
        let client_b = vec![text_element("a"), text_element("b")];

        let _ = cache
            .get_or_prepare(&client_a, |_| {
                calls.fetch_add(1, Ordering::SeqCst);
                Ok(vec![1])
            })
            .unwrap();
        let _ = cache
            .get_or_prepare(&client_b, |_| {
                calls.fetch_add(1, Ordering::SeqCst);
                Ok(vec![2])
            })
            .unwrap();

        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn changing_elements_changes_the_revision() {
        let old = vec![text_element("a")];
        let new = vec![text_element("b")];

        assert_ne!(
            elements_revision(&old).unwrap(),
            elements_revision(&new).unwrap()
        );
    }

    #[test]
    fn preparation_failure_is_not_cached() {
        let mut cache = StaticDataCache::new(STATIC_DATA_CACHE_CAPACITY);
        let calls = AtomicUsize::new(0);
        let elements = vec![text_element("a")];

        for _ in 0..2 {
            let result = cache.get_or_prepare(&elements, |_| {
                calls.fetch_add(1, Ordering::SeqCst);
                Err("preparation failed".to_string())
            });
            assert!(result.is_err());
        }

        assert_eq!(calls.load(Ordering::SeqCst), 2);
        assert_eq!(cache.len(), 0);
    }

    #[test]
    fn cache_capacity_is_bounded() {
        let mut cache = StaticDataCache::new(2);

        for id in ["a", "b", "c"] {
            let elements = vec![text_element(id)];
            let _ = cache.get_or_prepare(&elements, |_| Ok(vec![1])).unwrap();
        }

        assert_eq!(cache.len(), 2);
    }
}
