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

pub fn mk_hook_output(tool_input: ToolInput, original: &str) -> HookOutput {
    let additional_context = {
        let rewritten = &tool_input.command;
        format!(
            "`rm`コマンドを`trash`コマンドに自動的に書き換えました。\n元: {original}\n後: {rewritten}",
        )
    };
    HookOutput {
        hook_specific_output: HookSpecificOutput {
            hook_event_name: "PreToolUse",
            permission_decision: "allow",
            updated_input: tool_input,
            additional_context,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn decodes_minimal_input() {
        let input = r#"{"tool_input": {"command": "rm foo"}}"#;
        let decoded = decode_hook_input(input).expect("should decode");
        assert_eq!(decoded.tool_input.command, "rm foo");
        assert!(decoded.tool_input.extra.is_empty());
    }

    #[test]
    fn decodes_input_with_extra_fields() {
        let input = r#"{
            "tool_input": {
                "command": "rm bar",
                "description": "delete bar",
                "timeout": 30
            },
            "session_id": "abc123"
        }"#;
        let decoded = decode_hook_input(input).expect("should decode");
        assert_eq!(decoded.tool_input.command, "rm bar");
        assert_eq!(
            decoded.tool_input.extra.get("description"),
            Some(&json!("delete bar")),
        );
        assert_eq!(decoded.tool_input.extra.get("timeout"), Some(&json!(30)));
    }

    #[test]
    fn rejects_invalid_json() {
        assert!(decode_hook_input("not json").is_err());
    }

    #[test]
    fn rejects_missing_tool_input() {
        assert!(decode_hook_input("{}").is_err());
    }

    #[test]
    fn rejects_missing_command() {
        assert!(decode_hook_input(r#"{"tool_input": {}}"#).is_err());
    }

    #[test]
    fn output_contains_expected_fields() {
        let tool_input = ToolInput {
            command: "trash foo".to_string(),
            extra: serde_json::Map::new(),
        };
        let output = mk_hook_output(tool_input, "rm foo");
        let value = serde_json::to_value(&output).expect("should serialize");

        let specific = &value["hookSpecificOutput"];
        assert_eq!(specific["hookEventName"], "PreToolUse");
        assert_eq!(specific["permissionDecision"], "allow");
        assert_eq!(specific["updatedInput"]["command"], "trash foo");
        let context = specific["additionalContext"]
            .as_str()
            .expect("additionalContext should be a string");
        assert!(
            context.contains("元: rm foo"),
            "context should contain original"
        );
        assert!(
            context.contains("後: trash foo"),
            "context should contain rewritten",
        );
    }

    #[test]
    fn output_preserves_extra_fields() {
        let mut extra = serde_json::Map::new();
        extra.insert("description".to_string(), json!("delete temp files"));
        let tool_input = ToolInput {
            command: "trash tmp".to_string(),
            extra,
        };
        let output = mk_hook_output(tool_input, "rm tmp");
        let value = serde_json::to_value(&output).expect("should serialize");
        assert_eq!(
            value["hookSpecificOutput"]["updatedInput"]["description"],
            json!("delete temp files"),
        );
    }
}
