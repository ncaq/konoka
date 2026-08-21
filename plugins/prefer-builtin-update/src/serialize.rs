//! Claude CodeのPreToolUseフックI/O用JSONのシリアライズとデシリアライズ。

use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct ToolInput {
    pub command: String,
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
    permission_decision_reason: String,
}

pub fn decode_hook_input(input: &str) -> serde_json::Result<HookInput> {
    serde_json::from_str(input)
}

/// 拒否理由に添える`Edit`ツールへの誘導文。
///
/// このフックは無条件に拒否するため、
/// 同じコマンドをリトライさせる案内をしてはいけない。
/// 大量置換の逃げ道としてこのフックの検出対象外である、
/// スクリプトファイルの書き出しと実行を案内する。
const GUIDANCE: &str = concat!(
    "Use the builtin Edit tool to modify files ",
    "(or the Write tool to create or fully rewrite a file). ",
    "Edit produces reviewable diffs and avoids shell quoting problems. ",
    "If this is a huge mechanical replacement that is impractical with Edit, ",
    "write the replacement logic to a script file with the Write tool, ",
    "explain to the user what it does, and run that file instead of a one-liner.",
);

/// 検出内容の説明文から拒否用のフック出力を組み立てる。
pub fn mk_deny_output(detected: &str) -> HookOutput {
    let permission_decision_reason = format!("Detected {detected}. {GUIDANCE}");
    HookOutput {
        hook_specific_output: HookSpecificOutput {
            hook_event_name: "PreToolUse",
            permission_decision: "deny",
            permission_decision_reason,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_minimal_input() {
        let input = r#"{"tool_input": {"command": "sed -i s/a/b/ foo"}}"#;
        let decoded = decode_hook_input(input).expect("should decode");
        assert_eq!(decoded.tool_input.command, "sed -i s/a/b/ foo");
    }

    #[test]
    fn decodes_input_with_extra_fields() {
        let input = r#"{
            "tool_input": {
                "command": "sed -i s/a/b/ foo",
                "description": "replace a with b",
                "timeout": 30
            },
            "session_id": "abc123"
        }"#;
        let decoded = decode_hook_input(input).expect("should decode");
        assert_eq!(decoded.tool_input.command, "sed -i s/a/b/ foo");
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
        let output = mk_deny_output("`sed -i` style in-place editing");
        let value = serde_json::to_value(&output).expect("should serialize");

        let specific = &value["hookSpecificOutput"];
        assert_eq!(specific["hookEventName"], "PreToolUse");
        assert_eq!(specific["permissionDecision"], "deny");
        let reason = specific["permissionDecisionReason"]
            .as_str()
            .expect("permissionDecisionReason should be a string");
        assert!(
            reason.contains("`sed -i` style in-place editing"),
            "reason should contain the detected description",
        );
        assert!(
            reason.contains("Edit tool"),
            "reason should steer to the Edit tool",
        );
    }
}
