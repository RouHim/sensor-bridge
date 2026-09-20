use std::num::NonZeroUsize;
use std::sync::{Arc, Mutex};

use bytes::Bytes;
use lru::LruCache;
use sensor_core::ElementConfig;

/// A prepared payload ready to be served to a client.
#[derive(Debug, Clone)]
pub struct PreparedStaticData {
    /// Revision identifier of the payload: stable while the elements are
    /// unchanged, different after any element edit.
    pub revision: String,
    /// Serialized static data (bincode-next). Refcounted, so serving an entry
    /// never copies the payload.
    pub bytes: Bytes,
}

/// Shared handle to the cache.
pub type StaticDataCacheHandle = Arc<Mutex<StaticDataCache>>;

/// Enough entries for a handful of distinct display configurations while
/// keeping font/image blobs memory-bounded.
pub const STATIC_DATA_CACHE_CAPACITY: usize = 8;

/// Bounded cache of prepared static-data payloads, keyed by elements revision.
///
/// The API is two-phase on purpose: `get` and `put` each hold the cache lock
/// only for the length of the map operation, so preparation (fonts, images,
/// network fetches) runs without the lock and a hit never waits for an
/// in-flight preparation. Cached revisions are still shared between clients.
///
/// Cold preparations cannot run concurrently, though: preparation rebuilds the
/// shared on-disk asset folders (see [`Self::prepare_lock`]), so every writer of
/// those folders - the HTTP miss path, the LCD preview and the UI
/// conditional-image preview - serializes through the preparation mutex; the
/// HTTP miss path additionally re-checks the cache under that mutex. A revision
/// is therefore prepared once per cold burst, and the other requests of the
/// burst return the freshly cached payload. Failures are never cached.
pub struct StaticDataCache {
    entries: LruCache<String, PreparedStaticData>,
    /// One process-wide preparation mutex, shared by every handle of this cache.
    prepare_lock: Arc<Mutex<()>>,
}

impl StaticDataCache {
    pub fn new(capacity: usize) -> Self {
        Self {
            entries: LruCache::new(
                NonZeroUsize::new(capacity).expect("cache capacity must be greater than zero"),
            ),
            prepare_lock: Arc::new(Mutex::new(())),
        }
    }

    /// Handle of the process-wide preparation mutex: the single gate for every
    /// writer of the shared on-disk asset folders. Those writers are the HTTP
    /// static-data preparation, the LCD preview preparation
    /// ([`crate::lcd_preview::show`]) and the UI conditional-image preview
    /// command in `main.rs`.
    ///
    /// Preparation is not idempotent: it removes and recreates the per-element
    /// cache directories before re-extracting/resizing their contents, so two
    /// concurrent preparations collide on disk (a failed rename, or an
    /// emptied-but-not-yet-refilled directory served as a successful empty
    /// payload). Holding this mutex across a preparation makes cold
    /// preparations of a revision run one at a time no matter which caller
    /// starts them.
    ///
    /// The returned handle is cloned out under the map lock, so callers can
    /// acquire it without holding the cache guard. That is the only acquisition
    /// order used anywhere: the cache map lock is never held while this lock is
    /// acquired, and the HTTP miss path re-takes the map lock for its re-check
    /// and `put` only while already holding this one (preparation lock, then
    /// map lock).
    pub fn prepare_lock(&self) -> Arc<Mutex<()>> {
        self.prepare_lock.clone()
    }

    /// Returns the cached payload for this revision, if it has been prepared
    /// before. The hit is a clone of the stored handle, never a re-preparation.
    pub fn get(&mut self, revision: &str) -> Option<PreparedStaticData> {
        self.entries.get(revision).cloned()
    }

    /// Stores a freshly prepared payload and returns the stored handle. A
    /// payload prepared twice for the same revision is simply stored twice
    /// under the same key, so the cache still holds exactly one entry.
    pub fn put(&mut self, revision: String, bytes: Vec<u8>) -> PreparedStaticData {
        let prepared = PreparedStaticData {
            revision: revision.clone(),
            bytes: bytes.into(),
        };
        self.entries.put(revision, prepared.clone());

        prepared
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

    /// Mirrors the handler's two-phase use of the cache: look the revision up
    /// first and only prepare (counting the attempt) on a miss.
    fn serve(
        cache: &mut StaticDataCache,
        elements: &[ElementConfig],
        calls: &AtomicUsize,
        prepare: impl FnOnce() -> Result<Vec<u8>, String>,
    ) -> Result<PreparedStaticData, String> {
        let revision = elements_revision(elements)?;

        if let Some(hit) = cache.get(&revision) {
            return Ok(hit);
        }

        calls.fetch_add(1, Ordering::SeqCst);
        let bytes = prepare()?;

        Ok(cache.put(revision, bytes))
    }

    #[test]
    fn prepares_once_per_elements_revision() {
        let mut cache = StaticDataCache::new(STATIC_DATA_CACHE_CAPACITY);
        let calls = AtomicUsize::new(0);
        let elements = vec![text_element("a")];

        let first = serve(&mut cache, &elements, &calls, || Ok(vec![1, 2, 3])).unwrap();
        let second = serve(&mut cache, &elements, &calls, || Ok(vec![9, 9])).unwrap();

        assert_eq!(calls.load(Ordering::SeqCst), 1);
        assert_eq!(first.revision, second.revision);
        assert_eq!(second.bytes, Bytes::from(vec![1, 2, 3]));
    }

    #[test]
    fn identical_elements_of_two_clients_share_one_revision() {
        let mut cache = StaticDataCache::new(STATIC_DATA_CACHE_CAPACITY);
        let calls = AtomicUsize::new(0);
        let client_a = vec![text_element("a"), text_element("b")];
        let client_b = vec![text_element("a"), text_element("b")];

        let _ = serve(&mut cache, &client_a, &calls, || Ok(vec![1])).unwrap();
        let _ = serve(&mut cache, &client_b, &calls, || Ok(vec![2])).unwrap();

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
            let result = serve(&mut cache, &elements, &calls, || {
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
        let calls = AtomicUsize::new(0);

        for id in ["a", "b", "c"] {
            let elements = vec![text_element(id)];
            let _ = serve(&mut cache, &elements, &calls, || Ok(vec![1])).unwrap();
        }

        assert_eq!(cache.len(), 2);
    }
}
