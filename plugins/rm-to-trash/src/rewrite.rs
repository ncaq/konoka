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

/// trash-cliがrm互換のために受理する短縮フラグの文字。
///
/// `trash --help`で確認できる`-r`/`-R`/`-f`/`-d`/`-i`/`-v`に対応する。
/// 結合形(`-rf`等)は全文字がこの集合に含まれれば許可する。
const COMPAT_SHORT: [char; 6] = ['r', 'R', 'f', 'd', 'i', 'v'];

/// trash-cliがrm互換のために受理する長形式フラグ。
///
/// rmの`--dir`はtrashが受理しないため含めない。
const COMPAT_LONG: [&str; 5] = [
    "--recursive",
    "--force",
    "--interactive",
    "--verbose",
    "--directory",
];

/// `after`(`rm`より後のトークン列)に、trash-cliが受理しないフラグが含まれるか。
///
/// trash-cliはrm互換のため一部のフラグを受理するので、
/// 互換フラグだけなら書き換えても挙動が保たれる。
/// `-I`や`--no-preserve-root`のような非互換フラグが一つでもあれば書き換えを拒否する。
///
/// 走査は次の`Punctuation`(コマンド境界)まで。以降は別コマンドなので対象外。
/// `--`(オプション終端)に達した時点で先行トークンは全て検査済みなので、
/// 以降はファイル名のみと判断して非互換なしを確定する。
fn has_incompatible_flag_after(after: &[Tok]) -> bool {
    for tok in after {
        match tok {
            Tok::Punctuation(_) => break,
            Tok::Word(w) => {
                if *w == "--" {
                    return false;
                } else if w.starts_with("--") {
                    if !COMPAT_LONG.contains(w) {
                        return true;
                    }
                } else if let Some(short) = w.strip_prefix('-')
                    && (short.is_empty() || !short.chars().all(|c| COMPAT_SHORT.contains(&c)))
                {
                    return true;
                }
            }
            Tok::Whitespace(_) => {}
        }
    }
    false
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
            && (is_git_before(&tokens[..i]) || has_incompatible_flag_after(&tokens[i + 1..]))
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
    fn rewrites_rm_with_compatible_short_flag() {
        assert_eq!(
            rewrite("rm -rf /tmp/foo").as_deref(),
            Some("trash -rf /tmp/foo"),
        );
    }

    #[test]
    fn rewrites_rm_with_compatible_long_flag() {
        assert_eq!(
            rewrite("rm --recursive foo").as_deref(),
            Some("trash --recursive foo"),
        );
    }

    #[test]
    fn rewrites_compound_with_compatible_flag() {
        assert_eq!(
            rewrite("rm a && rm -rf b").as_deref(),
            Some("trash a && trash -rf b"),
        );
    }

    #[test]
    fn rewrites_force_flag() {
        assert_eq!(rewrite("rm -f foo").as_deref(), Some("trash -f foo"));
    }

    #[test]
    fn rewrites_interactive_flag() {
        assert_eq!(rewrite("rm -i foo").as_deref(), Some("trash -i foo"));
    }

    #[test]
    fn rewrites_directory_flag() {
        assert_eq!(rewrite("rm -d empty").as_deref(), Some("trash -d empty"));
    }

    #[test]
    fn rewrites_verbose_flag() {
        assert_eq!(rewrite("rm -v foo").as_deref(), Some("trash -v foo"));
    }

    #[test]
    fn rewrites_combined_short_flags() {
        assert_eq!(rewrite("rm -rfv foo").as_deref(), Some("trash -rfv foo"));
    }

    #[test]
    fn rewrites_long_force_flag() {
        assert_eq!(
            rewrite("rm --force foo").as_deref(),
            Some("trash --force foo"),
        );
    }

    #[test]
    fn rewrites_with_end_of_options() {
        assert_eq!(
            rewrite("rm -rf -- -foo").as_deref(),
            Some("trash -rf -- -foo"),
        );
    }

    #[test]
    fn rewrites_flag_after_operand() {
        assert_eq!(rewrite("rm foo -rf").as_deref(), Some("trash foo -rf"));
    }

    #[test]
    fn skips_incompatible_flag_before_end_of_options() {
        assert!(rewrite("rm -I -- foo").is_none());
    }

    #[test]
    fn skips_rm_with_incompatible_short_flag() {
        assert!(rewrite("rm -I foo").is_none());
    }

    #[test]
    fn skips_rm_with_one_file_system() {
        assert!(rewrite("rm -rf --one-file-system /").is_none());
    }

    #[test]
    fn skips_rm_with_no_preserve_root() {
        assert!(rewrite("rm --no-preserve-root -rf /").is_none());
    }

    #[test]
    fn skips_rm_with_interactive_when() {
        assert!(rewrite("rm --interactive=always foo").is_none());
    }

    #[test]
    fn skips_compatible_long_flag_with_value() {
        assert!(rewrite("rm --recursive=foo bar").is_none());
    }

    #[test]
    fn skips_rm_with_dir_long_flag() {
        assert!(rewrite("rm --dir empty").is_none());
    }

    #[test]
    fn skips_mixed_compatible_and_incompatible_flags() {
        assert!(rewrite("rm -r -I foo").is_none());
    }

    #[test]
    fn skips_combined_short_flag_with_incompatible_char() {
        assert!(rewrite("rm -rI foo").is_none());
    }

    #[test]
    fn skips_compound_when_one_has_incompatible_flag() {
        assert!(rewrite("rm -rf a && rm -I b").is_none());
    }

    #[test]
    fn does_not_misdetect_flag_of_other_command() {
        assert_eq!(
            rewrite("rm a | grep -I x").as_deref(),
            Some("trash a | grep -I x"),
        );
    }

    #[test]
    fn skips_git_rm_with_compatible_flag() {
        assert!(rewrite("git rm -rf foo").is_none());
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
