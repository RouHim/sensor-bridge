/// Serializes a value with the bincode-1-compatible config (`config::legacy()`:
/// little endian + fixed integers). `config::standard()` uses varint encoding and
/// would silently change the wire format.
pub fn encode<T: serde::Serialize>(value: &T) -> Result<Vec<u8>, String> {
    bincode_next::serde::encode_to_vec(value, bincode_next::config::legacy())
        .map_err(|err| format!("Failed to serialize: {}", err))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_config_keeps_the_bincode_1_wire_format() {
        // bincode 1 encodes a Vec as u64 length (little endian) followed by the elements,
        // with fixed-width integers. `config::standard()` (varint) would produce [3, 1, 2, 3].
        let bytes = encode(&vec![1u8, 2, 3]).expect("encoding must succeed");
        assert_eq!(bytes, vec![3, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3]);
    }
}
