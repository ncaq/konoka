use crate::serialize::{ToolInput, mk_hook_output};

/// 書き換わったコマンドを標準出力にJSONで出力する。
pub fn output_tool_input(
    tool_input: ToolInput,
    original: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let output = mk_hook_output(tool_input, original);
    let json = serde_json::to_string(&output)?;
    println!("{json}");
    Ok(())
}
