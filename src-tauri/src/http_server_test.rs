//! Delivery matrix for the HTTP contract: the reload flag is cleared only by an
//! explicit confirmation for the revision that is current for the client.

use std::sync::{Arc, Mutex, RwLock};

use sensor_core::{ElementConfig, ElementType, SensorValue};
use warp::http::StatusCode;
use warp::test;

use crate::config_file::AppConfig;
use crate::http_server::{routes, DisplayClient};
use crate::in_memory_config::InMemoryConfig;
use crate::sensor::SensorSnapshot;
use crate::static_data_cache::{StaticDataCache, STATIC_DATA_CACHE_CAPACITY};
use crate::utils::LockResultExt;

const CLIENT_A: &str = "AA:BB:CC:DD:EE:01";
const CLIENT_B: &str = "AA:BB:CC:DD:EE:02";
const CLIENT_INACTIVE: &str = "AA:BB:CC:DD:EE:03";
const CLIENT_BROKEN_ASSET: &str = "AA:BB:CC:DD:EE:04";
const CLIENT_NO_ELEMENTS: &str = "AA:BB:CC:DD:EE:05";

fn test_font_family() -> String {
    crate::fonts::get_all()
        .first()
        .cloned()
        .expect("this test needs at least one system font")
}

fn text_element(id: &str) -> ElementConfig {
    ElementConfig {
        id: id.to_string(),
        name: id.to_string(),
        element_type: ElementType::Text,
        text_config: Some(sensor_core::TextConfig {
            sensor_id: "cpu_load_total".to_string(),
            format: "{value} {unit}".to_string(),
            font_family: test_font_family(),
            width: 32,
            height: 16,
            ..Default::default()
        }),
        ..Default::default()
    }
}

fn broken_image_element(id: &str) -> ElementConfig {
    ElementConfig {
        id: id.to_string(),
        element_type: ElementType::StaticImage,
        image_config: Some(sensor_core::ImageConfig {
            width: 4,
            height: 4,
            image_path: "/definitely/not/a/real/image.png".to_string(),
        }),
        ..Default::default()
    }
}

fn client(mac: &str, active: bool, elements: Vec<ElementConfig>) -> DisplayClient {
    DisplayClient {
        mac_address: mac.to_string(),
        name: format!("test-{mac}"),
        ip_address: "127.0.0.1".to_string(),
        resolution_width: 100,
        resolution_height: 100,
        active,
        elements,
        static_data_reload_required: true,
    }
}

async fn set_elements(config: &InMemoryConfig, mac: &str, elements: Vec<ElementConfig>) {
    let mut guard = config.write().await;
    let client = guard.display_clients.get_mut(mac).unwrap();
    client.elements = elements;
    client.static_data_reload_required = true;
}

async fn reload_required(config: &InMemoryConfig, mac: &str) -> bool {
    config
        .read()
        .await
        .display_clients
        .get(mac)
        .unwrap()
        .static_data_reload_required
}

fn response_json(body: &[u8]) -> serde_json::Value {
    serde_json::from_slice(body).expect("response body must be JSON")
}

#[tokio::test]
async fn static_data_delivery_matrix() {
    std::env::set_var("SENSOR_BRIDGE_APP_NAME", "sensor-bridge-http-test");
    let _ = std::fs::remove_dir_all(sensor_core::get_config_dir());

    let mut app_config = AppConfig::default();
    app_config.display_clients.insert(
        CLIENT_A.to_string(),
        client(CLIENT_A, true, vec![text_element("a")]),
    );
    app_config.display_clients.insert(
        CLIENT_B.to_string(),
        client(CLIENT_B, true, vec![text_element("a")]),
    );
    app_config.display_clients.insert(
        CLIENT_INACTIVE.to_string(),
        client(CLIENT_INACTIVE, false, vec![text_element("a")]),
    );
    app_config.display_clients.insert(
        CLIENT_BROKEN_ASSET.to_string(),
        client(
            CLIENT_BROKEN_ASSET,
            true,
            vec![broken_image_element("broken")],
        ),
    );
    app_config.display_clients.insert(
        CLIENT_NO_ELEMENTS.to_string(),
        client(CLIENT_NO_ELEMENTS, true, vec![]),
    );

    let in_memory_config: InMemoryConfig = Arc::new(tokio::sync::RwLock::new(app_config));
    let sensor_snapshot: Arc<RwLock<Option<SensorSnapshot>>> = Arc::new(RwLock::new(None));
    let cache = Arc::new(Mutex::new(StaticDataCache::new(STATIC_DATA_CACHE_CAPACITY)));
    let routes = routes(
        in_memory_config.clone(),
        sensor_snapshot.clone(),
        cache.clone(),
    );

    // 1. Unknown client -> 404
    let response = test::request()
        .method("GET")
        .path("/api/static-data?mac_address=AA:BB:CC:DD:EE:99")
        .reply(&routes)
        .await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    // 2. Inactive client -> 403
    let response = test::request()
        .method("GET")
        .path(&format!("/api/static-data?mac_address={CLIENT_INACTIVE}"))
        .reply(&routes)
        .await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);

    // 2b. The confirmation endpoint shares the client-status semantics: unknown
    //     client -> 404, inactive client -> 403, and a case variant of the MAC
    //     resolves the same client.
    let response = test::request()
        .method("POST")
        .path("/api/static-data/ack")
        .json(&serde_json::json!({
            "mac_address": "aa:bb:cc:dd:ee:99",
            "revision": "0000000000000000000000000000dead"
        }))
        .reply(&routes)
        .await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let response = test::request()
        .method("POST")
        .path("/api/static-data/ack")
        .json(&serde_json::json!({
            "mac_address": CLIENT_INACTIVE.to_lowercase(),
            "revision": "0000000000000000000000000000dead"
        }))
        .reply(&routes)
        .await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    assert!(reload_required(&in_memory_config, CLIENT_INACTIVE).await);

    // 3. Active client with pending reload -> 200, revision + protocol headers,
    //    payload non-empty, and the pending flag must survive the GET
    let response = test::request()
        .method("GET")
        .path(&format!("/api/static-data?mac_address={CLIENT_A}"))
        .reply(&routes)
        .await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers().get("content-type").unwrap(),
        "application/octet-stream"
    );
    assert_eq!(
        response.headers().get("x-protocol-version").unwrap(),
        sensor_core::PROTOCOL_VERSION.to_string().as_str()
    );
    let revision_a = response
        .headers()
        .get("x-static-data-revision")
        .unwrap()
        .to_str()
        .unwrap()
        .to_string();
    assert!(!response.body().is_empty());
    assert!(
        reload_required(&in_memory_config, CLIENT_A).await,
        "GET must not clear the flag"
    );

    // 4. Identical elements of a second client reuse the prepared payload
    let response = test::request()
        .method("GET")
        .path(&format!("/api/static-data?mac_address={CLIENT_B}"))
        .reply(&routes)
        .await;
    assert_eq!(
        response.headers().get("x-static-data-revision").unwrap(),
        revision_a.as_str()
    );
    assert_eq!(cache.lock().ignore_poison().len(), 1);

    // 5. Confirmation with a stale revision does not clear the flag
    let response = test::request()
        .method("POST")
        .path("/api/static-data/ack")
        .json(&serde_json::json!({ "mac_address": CLIENT_A, "revision": "0000000000000000000000000000dead" }))
        .reply(&routes)
        .await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response_json(response.body()),
        serde_json::json!({ "pending_cleared": false, "success": true })
    );
    assert!(reload_required(&in_memory_config, CLIENT_A).await);

    // 6. Confirmation for the delivered revision clears the flag of that client only
    let response = test::request()
        .method("POST")
        .path("/api/static-data/ack")
        .json(&serde_json::json!({ "mac_address": CLIENT_A, "revision": revision_a }))
        .reply(&routes)
        .await;
    assert_eq!(response.status(), StatusCode::OK);
    assert!(!reload_required(&in_memory_config, CLIENT_A).await);
    assert!(
        reload_required(&in_memory_config, CLIENT_B).await,
        "other clients are unaffected"
    );

    // 7. Repeated confirmation is idempotent
    let response = test::request()
        .method("POST")
        .path("/api/static-data/ack")
        .json(&serde_json::json!({ "mac_address": CLIENT_A, "revision": revision_a }))
        .reply(&routes)
        .await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response_json(response.body()),
        serde_json::json!({ "pending_cleared": false, "success": true })
    );

    // 8. A stale confirmation must not discard the newer pending update
    set_elements(
        &in_memory_config,
        CLIENT_A,
        vec![text_element("a"), text_element("b")],
    )
    .await;
    let response = test::request()
        .method("POST")
        .path("/api/static-data/ack")
        .json(&serde_json::json!({ "mac_address": CLIENT_A, "revision": revision_a }))
        .reply(&routes)
        .await;
    assert_eq!(response.status(), StatusCode::OK);
    assert!(reload_required(&in_memory_config, CLIENT_A).await);

    let response = test::request()
        .method("GET")
        .path(&format!("/api/static-data?mac_address={CLIENT_A}"))
        .reply(&routes)
        .await;
    let new_revision = response
        .headers()
        .get("x-static-data-revision")
        .unwrap()
        .to_str()
        .unwrap()
        .to_string();
    assert_ne!(new_revision, revision_a);

    let response = test::request()
        .method("POST")
        .path("/api/static-data/ack")
        .json(&serde_json::json!({ "mac_address": CLIENT_A, "revision": new_revision }))
        .reply(&routes)
        .await;
    assert_eq!(
        response_json(response.body()),
        serde_json::json!({ "pending_cleared": true, "success": true })
    );
    assert!(!reload_required(&in_memory_config, CLIENT_A).await);

    // 9. Preparation failure -> 500, flag unchanged, failure not cached
    let response = test::request()
        .method("GET")
        .path(&format!(
            "/api/static-data?mac_address={CLIENT_BROKEN_ASSET}"
        ))
        .reply(&routes)
        .await;
    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    assert!(reload_required(&in_memory_config, CLIENT_BROKEN_ASSET).await);
    let response = test::request()
        .method("GET")
        .path(&format!(
            "/api/static-data?mac_address={CLIENT_BROKEN_ASSET}"
        ))
        .reply(&routes)
        .await;
    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);

    // 10. A client without elements gets a normal, legitimately empty payload.
    //     The GET still must not clear its pending flag.
    let response = test::request()
        .method("GET")
        .path(&format!(
            "/api/static-data?mac_address={CLIENT_NO_ELEMENTS}"
        ))
        .reply(&routes)
        .await;
    assert_eq!(response.status(), StatusCode::OK);
    assert!(!response.body().is_empty());
    assert!(reload_required(&in_memory_config, CLIENT_NO_ELEMENTS).await);

    // 11. Sensor data: 503 while no sample exists
    let response = test::request()
        .method("GET")
        .path(&format!(
            "/api/sensor-data?mac_address={}",
            CLIENT_A.to_lowercase()
        ))
        .reply(&routes)
        .await;
    assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);

    // 12. Sensor data: 200 from the cached snapshot, a MAC variant differing in
    //     case and surrounding whitespace resolves the same client, and the
    //     unused timestamp field is gone. (The whitespace is percent-encoded:
    //     `http::Uri`, and therefore `warp::test::request().path`, rejects raw
    //     spaces.)
    *sensor_snapshot.write().ignore_poison() = Some(SensorSnapshot {
        values: vec![SensorValue {
            id: "cpu_load_total".to_string(),
            value: "12.5".to_string(),
            unit: "%".to_string(),
            label: "Total CPU load".to_string(),
            sensor_type: sensor_core::SensorType::Number,
        }],
    });

    let padded_lowercase_mac = format!("%20{}%20", CLIENT_A.to_lowercase());
    let response = test::request()
        .method("GET")
        .path(&format!(
            "/api/sensor-data?mac_address={padded_lowercase_mac}"
        ))
        .reply(&routes)
        .await;
    assert_eq!(response.status(), StatusCode::OK);
    let body = response_json(response.body());
    assert!(
        body.get("timestamp").is_none(),
        "timestamp is no longer part of the contract"
    );
    assert_eq!(
        body["static_data_reload_required"],
        serde_json::json!(false)
    );
    assert_eq!(
        body["render_data"]["sensor_values"][0]["id"],
        "cpu_load_total"
    );

    // 13. Health exposes the protocol version
    let response = test::request()
        .method("GET")
        .path("/health")
        .reply(&routes)
        .await;
    let body = response_json(response.body());
    assert_eq!(body["protocol_version"], sensor_core::PROTOCOL_VERSION);

    // 14. Registration confirms the protocol version and the normalized MAC
    let response = test::request()
        .method("POST")
        .path("/api/register")
        .json(&serde_json::json!({
            "mac_address": CLIENT_A.to_lowercase(),
            "ip_address": "127.0.0.1",
            "resolution_width": 100,
            "resolution_height": 100
        }))
        .reply(&routes)
        .await;
    assert_eq!(response.status(), StatusCode::OK);
    let body = response_json(response.body());
    assert_eq!(body["protocol_version"], sensor_core::PROTOCOL_VERSION);
    assert_eq!(body["mac_address"], CLIENT_A);

    let _ = std::fs::remove_dir_all(sensor_core::get_config_dir());
}
