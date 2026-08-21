use crate::serialize::mk_deny_output;
use std::io::{self, Write};

/// 拒否の判断を標準出力にJSONで出力する。
pub fn output_deny(detected: &str) -> Result<(), Box<dyn std::error::Error>> {
    write_deny(io::stdout().lock(), detected)
}

/// 任意の`Write`にJSONを書き込む。
fn write_deny<W: Write>(mut writer: W, detected: &str) -> Result<(), Box<dyn std::error::Error>> {
    let output = mk_deny_output(detected);
    let json = serde_json::to_string(&output)?;
    writeln!(writer, "{json}")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    fn capture(detected: &str) -> String {
        let mut buf = Vec::new();
        write_deny(&mut buf, detected).expect("write should succeed");
        String::from_utf8(buf).expect("output should be utf-8")
    }

    #[test]
    fn writes_single_line_json() {
        let output = capture("`sed -i` style in-place file editing");
        assert!(output.ends_with('\n'), "output should end with newline");
        let trimmed = output.trim_end_matches('\n');
        assert!(!trimmed.contains('\n'), "JSON body should be a single line");
    }

    #[test]
    fn writes_expected_structure() {
        let output = capture("`sed -i` style in-place file editing");
        let value: Value = serde_json::from_str(output.trim_end()).expect("valid JSON");
        let specific = &value["hookSpecificOutput"];
        assert_eq!(specific["hookEventName"], "PreToolUse");
        assert_eq!(specific["permissionDecision"], "deny");
        assert!(
            specific["permissionDecisionReason"]
                .as_str()
                .expect("reason should be a string")
                .contains("`sed -i` style in-place file editing"),
        );
    }

    #[test]
    fn propagates_write_errors() {
        struct FailingWriter;
        impl Write for FailingWriter {
            fn write(&mut self, _buf: &[u8]) -> std::io::Result<usize> {
                Err(std::io::Error::other("simulated failure"))
            }
            fn flush(&mut self) -> std::io::Result<()> {
                Ok(())
            }
        }
        let result = write_deny(FailingWriter, "`sed -i` style in-place file editing");
        assert!(result.is_err());
    }
}
