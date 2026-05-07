//! PreToolUseフックで、Bashツールに渡された単純な`rm`を`trash`へ書き換えます。
//!
//! `rm`と`trash`はフラグ仕様に互換性がないため、書き換え対象は次の条件を満たすものに限定します。
//!
//! - シェルのトークン境界(行頭/末、空白、`;`, `&`, `|`, `()`, `` ` ``)で`rm`が単独で現れる(`rmdir`や`rm-utility`等は対象外)
//! - 直後にフラグ(`-`)が続かない(`rm -rf`は通常の承認フローに任せる)
//! - `git rm`のように`rm`が`git`のサブコマンドとして使われていない(`git trash`は存在しないため書き換えるとそもそも動かない)
//!
//! 対象外のケースは無音で終了し、Claude Code側の通常の承認フローへ委ねます。
//!
//! 入力を空白/シェルメタ文字/それ以外の単語の3種に分けたトークン列に変換し、
//! 各`rm`単語の前後をトークン単位で見て採否を決めます。

use serde::{Deserialize, Serialize};
use std::io::{self, Read};
use std::process::ExitCode;
use winnow::Parser;
use winnow::combinator::{alt, repeat};
use winnow::token::{one_of, take_while};

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

/// シェルコマンドを構成する最小単位のトークン。
#[derive(Debug, PartialEq, Eq)]
enum Tok<'s> {
    /// 連続する空白文字。
    Whitespace(&'s str),
    /// シェルメタ文字を1文字単位で保持する。`&&`は2連続の`Punctuation('&')`になる。
    Punctuation(char),
    /// 上記以外の連続文字列。コマンド名や引数に相当する。
    Word(&'s str),
}

const SHELL_PUNCTUATION: [char; 10] = ['(', ')', '{', '}', '<', '>', ';', '&', '|', '`'];

fn is_shell_special(c: char) -> bool {
    c.is_whitespace() || SHELL_PUNCTUATION.contains(&c)
}

fn whitespace<'s>(input: &mut &'s str) -> winnow::Result<Tok<'s>> {
    take_while(1.., |c: char| c.is_whitespace())
        .map(Tok::Whitespace)
        .parse_next(input)
}

fn punctuation<'s>(input: &mut &'s str) -> winnow::Result<Tok<'s>> {
    one_of(SHELL_PUNCTUATION)
        .map(Tok::Punctuation)
        .parse_next(input)
}

fn word<'s>(input: &mut &'s str) -> winnow::Result<Tok<'s>> {
    take_while(1.., |c: char| !is_shell_special(c))
        .map(Tok::Word)
        .parse_next(input)
}

fn token<'s>(input: &mut &'s str) -> winnow::Result<Tok<'s>> {
    alt((whitespace, punctuation, word)).parse_next(input)
}

fn tokenize(input: &str) -> Option<Vec<Tok<'_>>> {
    let result: Result<Vec<Tok<'_>>, _> = repeat(0.., token).parse(input);
    result.ok()
}

/// `before`(`rm`より前のトークン列)の末尾コマンド片に`git`があるか。
///
/// `Punctuation`(コマンド境界)に到達するまで末尾から遡り、
/// 途中に`Word("git")`があれば`git`サブコマンドの`rm`と判定する。
fn is_git_before(before: &[Tok]) -> bool {
    before
        .iter()
        .rev()
        .take_while(|t| !matches!(t, Tok::Punctuation(_)))
        .any(|t| matches!(t, Tok::Word("git")))
}

/// `after`(`rm`より後のトークン列)が空白を挟んでフラグ的単語(先頭が`-`)で始まるか。
fn is_flag_after(after: &[Tok]) -> bool {
    matches!(after, [Tok::Whitespace(_), Tok::Word(w), ..] if w.starts_with('-'))
}

/// 与えられたコマンド文字列を`trash`へ書き換える。
///
/// 書き換え対象でなければ`None`を返す。
fn rewrite(command: &str) -> Option<String> {
    let tokens = tokenize(command)?;

    if !tokens.iter().any(|t| matches!(t, Tok::Word("rm"))) {
        return None;
    }

    let rejected = tokens.iter().enumerate().any(|(i, t)| {
        matches!(t, Tok::Word("rm"))
            && (is_git_before(&tokens[..i]) || is_flag_after(&tokens[i + 1..]))
    });
    if rejected {
        return None;
    }

    let mut out = String::with_capacity(command.len() + 3);
    for tok in &tokens {
        match tok {
            Tok::Whitespace(s) => out.push_str(s),
            Tok::Punctuation(c) => out.push(*c),
            Tok::Word("rm") => out.push_str("trash"),
            Tok::Word(s) => out.push_str(s),
        }
    }
    Some(out)
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
    fn rewrites_pipe() {
        assert_eq!(rewrite("ls | rm foo").as_deref(), Some("ls | trash foo"));
    }

    #[test]
    fn rewrites_replace() {
        assert_eq!(rewrite("echo $(rm a)").as_deref(), Some("echo $(trash a)"));
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
    fn skips_partial_flag() {
        assert!(rewrite("rm a && rm -rf b").is_none());
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

    #[test]
    fn skips_git_rm() {
        assert!(rewrite("git rm foo").is_none());
    }

    #[test]
    fn skips_git_rm_with_short_option() {
        assert!(rewrite("git -C path rm foo").is_none());
    }

    #[test]
    fn skips_git_rm_with_long_option() {
        assert!(rewrite("git --no-pager rm foo").is_none());
    }

    #[test]
    fn skips_command_containing_git_rm() {
        assert!(rewrite("git rm foo && rm bar").is_none());
    }

    #[test]
    fn rewrites_sudo_rm() {
        assert_eq!(rewrite("sudo rm foo").as_deref(), Some("sudo trash foo"),);
    }

    #[test]
    fn rewrites_xargs_rm() {
        assert_eq!(
            rewrite("ls | xargs rm").as_deref(),
            Some("ls | xargs trash"),
        );
    }

    #[test]
    fn rewrites_timeout_rm() {
        assert_eq!(
            rewrite("timeout 5 rm foo").as_deref(),
            Some("timeout 5 trash foo"),
        );
    }
}
