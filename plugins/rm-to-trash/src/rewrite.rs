//! `rm`コマンド書き換えロジック。

use winnow::Parser;
use winnow::combinator::{alt, repeat};
use winnow::token::{one_of, take_while};

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
pub fn rewrite(command: &str) -> Option<String> {
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
    fn skips_empty() {
        assert!(rewrite("").is_none());
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
