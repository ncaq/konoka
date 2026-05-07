use crate::serialize::{ToolInput, mk_hook_output};
use std::io::{self, Write};

/// 書き換わったコマンドを標準出力にJSONで出力する。
pub fn output_tool_input(
    tool_input: ToolInput,
    original: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    write_tool_input(io::stdout().lock(), tool_input, original)
}

/// 任意の`Write`にJSONを書き込む。
fn write_tool_input<W: Write>(
    mut writer: W,
    tool_input: ToolInput,
    original: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let output = mk_hook_output(tool_input, original);
    let json = serde_json::to_string(&output)?;
    writeln!(writer, "{json}")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    fn capture(tool_input: ToolInput, original: &str) -> String {
        let mut buf = Vec::new();
        write_tool_input(&mut buf, tool_input, original).expect("write should succeed");
        String::from_utf8(buf).expect("output should be utf-8")
    }

    #[test]
    fn writes_single_line_json() {
        let tool_input = ToolInput {
            command: "trash foo".to_string(),
            extra: serde_json::Map::new(),
        };
        let output = capture(tool_input, "rm foo");
        assert!(output.ends_with('\n'), "output should end with newline");
        let trimmed = output.trim_end_matches('\n');
        assert!(!trimmed.contains('\n'), "JSON body should be a single line",);
    }

    #[test]
    fn writes_expected_structure() {
        let tool_input = ToolInput {
            command: "trash foo".to_string(),
            extra: serde_json::Map::new(),
        };
        let output = capture(tool_input, "rm foo");
        let value: Value = serde_json::from_str(output.trim_end()).expect("valid JSON");
        let specific = &value["hookSpecificOutput"];
        assert_eq!(specific["hookEventName"], "PreToolUse");
        assert_eq!(specific["permissionDecision"], "allow");
        assert_eq!(specific["updatedInput"]["command"], "trash foo");
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
        let tool_input = ToolInput {
            command: "trash foo".to_string(),
            extra: serde_json::Map::new(),
        };
        let result = write_tool_input(FailingWriter, tool_input, "rm foo");
        assert!(result.is_err());
    }
}
