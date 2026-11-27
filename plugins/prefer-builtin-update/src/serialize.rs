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

/// 拒否理由に添える誘導文の種類。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Guidance {
    /// ファイルの書き換えを`Edit`ツールへ誘導する。
    Update,
    /// インラインスクリプトの即座実行をスクリプトファイルの書き出しと実行へ誘導する。
    InlineScript,
}

impl Guidance {
    fn text(self) -> &'static str {
        match self {
            Guidance::Update => UPDATE_GUIDANCE,
            Guidance::InlineScript => INLINE_SCRIPT_GUIDANCE,
        }
    }
}

/// 拒否理由に添える`Edit`ツールへの誘導文。
///
/// このフックは無条件に拒否するため、
/// 同じコマンドをリトライさせる案内をしてはいけない。
/// 大量置換の逃げ道としてこのフックの検出対象外である、
/// スクリプトファイルの書き出しと実行を案内する。
const UPDATE_GUIDANCE: &str = concat!(
    "Use the builtin Edit tool to modify files ",
    "(or the Write tool to create or fully rewrite a file). ",
    "Edit produces reviewable diffs and avoids shell quoting problems. ",
    "If this is a huge mechanical replacement that is impractical with Edit, ",
    "write the replacement logic to a script file with the Write tool ",
    "so the user can inspect it before it runs, ",
    "explain to the user what it does, and run that file instead of a one-liner. ",
    "Run it with an interpreter such as bash or python3 ",
    "and let the script itself write the files, ",
    "because sed and awk commands and redirecting grep output to files ",
    "are rejected on the command line.",
);

/// 拒否理由に添えるスクリプトファイルの書き出しと実行への誘導文。
///
/// 処理系を変えただけの別のインラインスクリプトでリトライさせないように、
/// 書き方を問わず拒否されることと、
/// スクリプトを持ち出さずに済む専用のコマンドを案内する。
const INLINE_SCRIPT_GUIDANCE: &str = concat!(
    "Do not pass script source to an interpreter on the command line or through standard input. ",
    "Write the script to a file with the Write tool ",
    "so the user can inspect it before it runs, and run that file instead. ",
    "Inline scripts are hard to review and break on shell quoting. ",
    "Flags like `python3 -c`, `node -e`, `ruby -e`, and `perl -e`, ",
    "and heredocs or pipes feeding a script to an interpreter are all rejected, ",
    "so do not retry with another form of inline script. ",
    "For simple jobs prefer a dedicated command over a script, ",
    "such as jq for JSON or grep for searching.",
);

/// 検出内容の説明文から拒否用のフック出力を組み立てる。
pub fn mk_deny_output(detected: &str, guidance: Guidance) -> HookOutput {
    let permission_decision_reason = format!("Detected {detected}. {}", guidance.text());
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
        let output = mk_deny_output("`sed -i` style in-place editing", Guidance::Update);
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

    #[test]
    fn inline_script_output_steers_to_script_file() {
        let output = mk_deny_output(
            "inline script execution with `python3 -c`",
            Guidance::InlineScript,
        );
        let value = serde_json::to_value(&output).expect("should serialize");

        let reason = value["hookSpecificOutput"]["permissionDecisionReason"]
            .as_str()
            .expect("permissionDecisionReason should be a string");
        assert!(
            reason.contains("inline script execution with `python3 -c`"),
            "reason should contain the detected description",
        );
        assert!(
            reason.contains("Write the script to a file with the Write tool"),
            "reason should steer to writing a script file",
        );
        assert!(
            !reason.contains("Edit tool"),
            "reason should not steer to the Edit tool",
        );
    }
}
