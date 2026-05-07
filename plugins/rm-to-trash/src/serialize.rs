//! Claude CodeのPreToolUseフックI/O用JSONのシリアライズとデシリアライズ。

use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize)]
pub struct ToolInput {
    pub command: String,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

#[derive(Deserialize)]
pub struct HookInput {
    pub tool_input: ToolInput,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HookOutput {
    hook_specific_output: HookSpecificOutput,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HookSpecificOutput {
    hook_event_name: &'static str,
    permission_decision: &'static str,
    updated_input: ToolInput,
    additional_context: String,
}

pub fn decode_hook_input(input: &str) -> serde_json::Result<HookInput> {
    serde_json::from_str(input)
}

pub fn mk_hook_output(tool_input: ToolInput, original: &str, rewritten: &str) -> HookOutput {
    HookOutput {
        hook_specific_output: HookSpecificOutput {
            hook_event_name: "PreToolUse",
            permission_decision: "allow",
            updated_input: tool_input,
            additional_context: format!(
                "`rm`コマンドを`trash`コマンドに自動的に書き換えました。\n元: {original}\n後: {rewritten}"
            ),
        },
    }
}
