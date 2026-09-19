/// Serializes a value with the bincode-1-compatible config (`config::legacy()`:
/// little endian + fixed integers). `config::standard()` uses varint encoding and
/// would silently change the wire format.
pub fn encode<T: serde::Serialize>(value: &T) -> Result<Vec<u8>, String> {
    bincode_next::serde::encode_to_vec(value, bincode_next::config::legacy())
        .map_err(|err| format!("Failed to serialize: {}", err))
}

/// Deserializes a value written by [`encode`].
pub fn decode<T: serde::de::DeserializeOwned>(bytes: &[u8]) -> Result<T, String> {
    let (value, _bytes_read) =
        bincode_next::serde::decode_from_slice::<T, _>(bytes, bincode_next::config::legacy())
            .map_err(|err| format!("Failed to deserialize: {}", err))?;

    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use sensor_core::StaticClientData;
    use std::collections::HashMap;

    fn sample() -> StaticClientData {
        let mut text_data = HashMap::new();
        text_data.insert("Arial".to_string(), ("a1b2".to_string(), vec![1u8, 2, 3]));

        let mut conditional_image_data = HashMap::new();
        let mut series = HashMap::new();
        series.insert("0.png".to_string(), ("c3d4".to_string(), vec![9u8, 8]));
        conditional_image_data.insert("element-1".to_string(), series);

        StaticClientData {
            text_data,
            static_image_data: HashMap::new(),
            conditional_image_data,
        }
    }

    #[test]
    fn legacy_config_keeps_the_bincode_1_wire_format() {
        // bincode 1 encodes a Vec as u64 length (little endian) followed by the elements,
        // with fixed-width integers. `config::standard()` (varint) would produce [3, 1, 2, 3].
        let bytes = encode(&vec![1u8, 2, 3]).expect("encoding must succeed");
        assert_eq!(bytes, vec![3, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3]);
    }

    #[test]
    fn static_client_data_round_trips() {
        let original = sample();
        let bytes = encode(&original).expect("encoding must succeed");
        let decoded: StaticClientData = decode(&bytes).expect("decoding must succeed");

        assert_eq!(decoded.text_data, original.text_data);
        assert_eq!(
            decoded.conditional_image_data,
            original.conditional_image_data
        );
    }

    #[test]
    fn decoding_garbage_reports_an_error() {
        assert!(decode::<StaticClientData>(&[0xff, 0x00, 0x13]).is_err());
    }
}
