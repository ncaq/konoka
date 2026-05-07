use crate::serialize::{HookInput, decode_hook_input};
use std::io::{self, Read};

/// 標準入力からデータを読み込みデコードして返す。
pub fn read_hook_input() -> Result<HookInput, Box<dyn std::error::Error>> {
    read_hook_input_from(io::stdin().lock())
}

/// 任意の`Read`からデータを読み込みデコードして返す。
fn read_hook_input_from<R: Read>(mut reader: R) -> Result<HookInput, Box<dyn std::error::Error>> {
    let mut input = String::new();
    reader.read_to_string(&mut input)?;
    Ok(decode_hook_input(&input)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_valid_input() {
        let input = br#"{"tool_input": {"command": "rm foo"}}"#;
        let result = read_hook_input_from(&input[..]).expect("should succeed");
        assert_eq!(result.tool_input.command, "rm foo");
    }

    #[test]
    fn fails_on_invalid_json() {
        let input = b"not json";
        assert!(read_hook_input_from(&input[..]).is_err());
    }

    #[test]
    fn fails_on_empty_input() {
        let input: &[u8] = b"";
        assert!(read_hook_input_from(input).is_err());
    }

    #[test]
    fn propagates_io_errors() {
        struct FailingReader;
        impl Read for FailingReader {
            fn read(&mut self, _buf: &mut [u8]) -> std::io::Result<usize> {
                Err(std::io::Error::other("simulated failure"))
            }
        }
        assert!(read_hook_input_from(FailingReader).is_err());
    }
}
