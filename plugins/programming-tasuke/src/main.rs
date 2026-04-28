//! PreToolUseフックで、Bashツールに渡された単純な`rm`を`trash`へ書き換えます。
//!
//! `rm`と`trash`はフラグ仕様に互換性がないため、書き換え対象は次の条件を満たすものに限定します。
//!
//! - シェルのトークン境界(行頭/末、空白、`;`, `&`, `|`, `()`, `` ` ``)で`rm`が単独で現れる(`rmdir`や`rm-utility`等は対象外)
//! - 直後にフラグ(`-`)が続かない(`rm -rf`は通常の承認フローに任せる)
//!
//! 対象外のケースは無音で終了し、Claude Code側の通常の承認フローへ委ねます。

use regex_lite::Regex;
use serde::{Deserialize, Serialize};
use std::io::{self, Read};
use std::process::ExitCode;
use std::sync::LazyLock;

#[derive(Deserialize, Serialize)]
struct ToolInput {
    command: String,
    #[serde(flatten)]
    extra: serde_json::Map<String, serde_json::Value>,
}

#[derive(Deserialize)]
struct HookInput {
    tool_input: ToolInput,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HookOutput {
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

static RM_WORD_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(^|[\s;&|(){}<>`])rm($|[\s;&|`])").expect("static regex compiles")
});

static RM_WITH_FLAG_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(^|[\s;&|(){}<>`])rm\s+-").expect("static regex compiles"));

/// 与えられたコマンド文字列を`trash`へ書き換えます。
///
/// 書き換え対象でなければ`None`を返します。
///
/// 単語境界はシェルのトークン境界で判定し、
/// `rm-utility`のような`-`接続のシンボルは対象外にします。
fn rewrite(command: &str) -> Option<String> {
    if !RM_WORD_REGEX.is_match(command) || RM_WITH_FLAG_REGEX.is_match(command) {
        return None;
    }
    Some(
        RM_WORD_REGEX
            .replace_all(command, "${1}trash${2}")
            .into_owned(),
    )
}

fn main() -> ExitCode {
    let mut input = String::new();
    if io::stdin().read_to_string(&mut input).is_err() {
        return ExitCode::SUCCESS;
    }

    let Ok(payload) = serde_json::from_str::<HookInput>(&input) else {
        return ExitCode::SUCCESS;
    };
    let mut tool_input = payload.tool_input;
    let original = tool_input.command.clone();
    if original.is_empty() {
        return ExitCode::SUCCESS;
    }

    let Some(rewritten) = rewrite(&original) else {
        return ExitCode::SUCCESS;
    };
    tool_input.command = rewritten.clone();

    let output = HookOutput {
        hook_specific_output: HookSpecificOutput {
            hook_event_name: "PreToolUse",
            permission_decision: "allow",
            updated_input: tool_input,
            additional_context: format!(
                "`rm`コマンドを`trash`コマンドに自動的に書き換えました。\n元: {original}\n後: {rewritten}"
            ),
        },
    };

    match serde_json::to_string(&output) {
        Ok(json) => println!("{json}"),
        Err(e) => {
            eprintln!("Error: failed to serialize hook output: {e}");
            return ExitCode::FAILURE;
        }
    }
    ExitCode::SUCCESS
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rewrites_single_file() {
        assert_eq!(rewrite("rm foo.txt").as_deref(), Some("trash foo.txt"));
    }

    #[test]
    fn rewrites_multiple_files() {
        assert_eq!(
            rewrite("rm a.txt b.txt").as_deref(),
            Some("trash a.txt b.txt"),
        );
    }

    #[test]
    fn rewrites_rm_inside_compound_command() {
        assert_eq!(
            rewrite("cd foo && rm bar").as_deref(),
            Some("cd foo && trash bar"),
        );
    }

    #[test]
    fn rewrites_all_occurrences() {
        assert_eq!(rewrite("rm a; rm b").as_deref(), Some("trash a; trash b"),);
    }

    #[test]
    fn rewrite_groups_of_commands() {
        assert_eq!(rewrite("{rm a;}").as_deref(), Some("{trash a;}"),);
    }

    #[test]
    fn skips_rm_with_short_flag() {
        assert!(rewrite("rm -rf /tmp/foo").is_none());
    }

    #[test]
    fn skips_rm_with_long_flag() {
        assert!(rewrite("rm --recursive foo").is_none());
    }

    #[test]
    fn skips_rmdir() {
        assert!(rewrite("rmdir empty").is_none());
    }

    #[test]
    fn skips_word_containing_rm() {
        assert!(rewrite("npm install rm-utility").is_none());
    }

    #[test]
    fn skips_unrelated_command() {
        assert!(rewrite("ls foo").is_none());
    }
}
