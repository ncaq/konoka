//! ファイル書き換えコマンドの検出ロジック。

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

/// パス付きで書かれたコマンド名からコマンド名本体を取り出す。
fn basename(word: &str) -> &str {
    word.rsplit('/').next().unwrap_or(word)
}

/// in-place編集フラグ(`-i`)を持ちうるコマンドか。
fn is_inplace_capable(word: &str) -> bool {
    matches!(basename(word), "sed" | "perl" | "ruby")
}

/// `python`/`python3`/`python3.12`のようなPython処理系の名前か。
fn is_python(name: &str) -> bool {
    name.strip_prefix("python")
        .is_some_and(|rest| rest.chars().all(|c| c.is_ascii_digit() || c == '.'))
}

/// ワンライナーでファイルを書き換えうるスクリプト処理系の名前か。
fn is_interpreter(word: &str) -> bool {
    let name = basename(word);
    is_python(name) || matches!(name, "node" | "ruby" | "perl")
}

/// `after`(コマンド名より後のトークン列)にin-place編集フラグが含まれるか。
///
/// 走査は次の`Punctuation`(コマンド境界)まで。以降は別コマンドなので対象外。
/// `-i`は`-pi`や`-i.bak`のような結合形でも書かれるため、
/// `--`で始まらないフラグは`i`を含むかどうかで判定する。
fn has_inplace_flag(after: &[Tok]) -> bool {
    for tok in after {
        match tok {
            Tok::Punctuation(_) => break,
            Tok::Word(w) => {
                if w.starts_with("--in-place")
                    || (!w.starts_with("--") && w.starts_with('-') && w.contains('i'))
                {
                    return true;
                }
            }
            Tok::Whitespace(_) => {}
        }
    }
    false
}

/// 引用符で閉じられた書き込み系のファイルオープンモード。
///
/// `open('albums.json')`のようなファイル名を誤検出しないように、
/// 引用符で閉じた完全なモード文字列のみを対象にする。
/// ただし`open('a')`のようにファイル名がモード文字そのものの場合は誤検出する。
/// 誤検知を厳密に潰すよりワンライナー抑止側へ倒す方針なので許容している。
const WRITE_OPEN_MODES: [&str; 11] = [
    "w", "a", "wb", "ab", "wt", "at", "w+", "a+", "r+", "w+b", "a+b",
];

/// `open(`の引数部分に書き込みモードの指定があるか。
///
/// PythonやRubyの`open("file", "w")`形式と、
/// Perlの`open($fh, '>', "file")`形式を対象にする。
/// Perl形式の判定は開き引用符と`>`の並びだけを見て閉じ引用符を要求しないため、
/// `">"`との比較式のような無関係な並びにも一致する限界がある。
fn open_args_have_write_mode(args: &str) -> bool {
    ['\'', '"'].iter().any(|q| {
        WRITE_OPEN_MODES
            .iter()
            .any(|m| args.contains(&format!("{q}{m}{q}")))
            || args.contains(&format!("{q}>"))
    })
}

/// コマンド文字列全体にファイル書き込みを示すパターンがあるか。
///
/// `-c`や`-e`のワンライナーに限らずヒアドキュメントで渡されたコードも、
/// コマンド文字列全体を見ることで同時にカバーする。
fn has_write_pattern(command: &str) -> bool {
    // pathlibなどの書き込みメソッド。
    if ["write_text(", "write_bytes("]
        .iter()
        .any(|p| command.contains(p))
    {
        return true;
    }
    // Node.jsのfsモジュールの書き込み関数。
    if ["writeFile", "appendFile", "createWriteStream"]
        .iter()
        .any(|p| command.contains(p))
    {
        return true;
    }
    // Rubyの書き込みメソッド。
    if ["File.write", "File.binwrite", "IO.write", "IO.binwrite"]
        .iter()
        .any(|p| command.contains(p))
    {
        return true;
    }
    // `open(`の引数に書き込みモードがあるか。
    command.match_indices("open(").any(|(i, matched)| {
        match command[i + matched.len()..].split_once(')') {
            Some((args, _)) => open_args_have_write_mode(args),
            None => open_args_have_write_mode(&command[i + matched.len()..]),
        }
    })
}

/// 与えられたコマンド文字列からファイル書き換えを検出する。
///
/// 検出した場合は内容の英語説明文を返し、
/// 検出しなければ`None`を返す。
pub fn detect(command: &str) -> Option<String> {
    let tokens = tokenize(command)?;

    // sed/perl/rubyのin-place編集フラグ。
    let inplace = tokens.iter().enumerate().find_map(|(i, t)| match t {
        Tok::Word(w) if is_inplace_capable(w) && has_inplace_flag(&tokens[i + 1..]) => {
            Some(basename(w))
        }
        _ => None,
    });
    if let Some(cmd) = inplace {
        return Some(format!("`{cmd} -i` style in-place file editing"));
    }

    // スクリプト処理系のワンライナーによる書き込み推定。
    let interpreter = tokens.iter().find_map(|t| match t {
        Tok::Word(w) if is_interpreter(w) => Some(basename(w)),
        _ => None,
    });
    if let Some(cmd) = interpreter
        && has_write_pattern(command)
    {
        return Some(format!("a `{cmd}` one-liner that writes to files"));
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_sed_inplace() {
        assert!(detect("sed -i 's/foo/bar/' src/main.rs").is_some());
    }

    #[test]
    fn detects_sed_inplace_with_backup_suffix() {
        assert!(detect("sed -i.bak 's/foo/bar/' src/main.rs").is_some());
    }

    #[test]
    fn detects_sed_inplace_combined_flags() {
        assert!(detect("sed -ri 's/foo(x)/bar\\1/' src/main.rs").is_some());
    }

    #[test]
    fn detects_sed_inplace_long_flag() {
        assert!(detect("sed --in-place 's/foo/bar/' src/main.rs").is_some());
    }

    #[test]
    fn detects_sed_inplace_long_flag_with_suffix() {
        assert!(detect("sed --in-place=.bak 's/foo/bar/' src/main.rs").is_some());
    }

    #[test]
    fn detects_perl_inplace() {
        assert!(detect("perl -i -pe 's/foo/bar/' README.md").is_some());
    }

    #[test]
    fn detects_perl_inplace_combined_flags() {
        assert!(detect("perl -pi -e 's/foo/bar/' README.md").is_some());
    }

    #[test]
    fn detects_ruby_inplace() {
        assert!(detect("ruby -i -pe 'gsub(/foo/, \"bar\")' README.md").is_some());
    }

    #[test]
    fn detects_inplace_in_compound_command() {
        assert!(detect("cd src && sed -i 's/foo/bar/' main.rs").is_some());
    }

    #[test]
    fn detects_inplace_with_path_prefix() {
        assert!(detect("/usr/bin/sed -i 's/foo/bar/' main.rs").is_some());
    }

    #[test]
    fn detects_python_open_write() {
        let command = concat!(
            "python3 -c \"content = open('config.json').read().replace('a', 'b'); ",
            "open('config.json', 'w').write(content)\"",
        );
        assert!(detect(command).is_some());
    }

    #[test]
    fn detects_python_open_write_with_nested_call() {
        assert!(detect("python3 -c \"open(os.path.expanduser('~/a'), 'w').write(x)\"").is_some());
    }

    #[test]
    fn detects_python_open_write_without_closing_paren() {
        assert!(detect("python3 -c \"f = open('a.txt', 'w'\"").is_some());
    }

    #[test]
    fn detects_perl_open_append_mode() {
        assert!(detect("perl -e 'open($fh, \">>\", \"a.txt\"); print $fh \"x\"'").is_some());
    }

    #[test]
    fn detects_python_pathlib_write() {
        assert!(
            detect("python3 -c 'from pathlib import Path; Path(\"a.txt\").write_text(\"x\")'")
                .is_some()
        );
    }

    #[test]
    fn detects_python_heredoc_write() {
        assert!(
            detect("python3 <<EOF\nwith open('a.txt', 'w') as f:\n    f.write('x')\nEOF").is_some()
        );
    }

    #[test]
    fn detects_python_versioned_binary() {
        assert!(detect("python3.12 -c \"open('a.txt', 'w').write('x')\"").is_some());
    }

    #[test]
    fn detects_node_write_file() {
        assert!(detect("node -e 'require(\"fs\").writeFileSync(\"a.txt\", \"x\")'").is_some());
    }

    #[test]
    fn detects_ruby_file_write() {
        assert!(detect("ruby -e 'File.write(\"a.txt\", \"x\")'").is_some());
    }

    #[test]
    fn detects_perl_open_write() {
        assert!(detect("perl -e 'open(my $fh, \">\", \"a.txt\"); print $fh \"x\"'").is_some());
    }

    #[test]
    fn skips_sed_read_only() {
        assert!(detect("sed -n '1,10p' src/main.rs").is_none());
    }

    #[test]
    fn skips_sed_pipe_filter() {
        assert!(detect("cat log.txt | sed 's/foo/bar/'").is_none());
    }

    #[test]
    fn skips_flag_of_other_command() {
        assert!(detect("sed -n 1p a.txt && grep -i foo b.txt").is_none());
    }

    #[test]
    fn skips_python_script_execution() {
        assert!(detect("python3 script.py").is_none());
    }

    #[test]
    fn skips_python_read_only_oneliner() {
        assert!(detect("python3 -c \"print(open('config.json').read())\"").is_none());
    }

    #[test]
    fn skips_python_open_with_filename_starting_with_mode_letter() {
        assert!(detect("python3 -c \"print(open('albums.json').read())\"").is_none());
    }

    #[test]
    fn skips_node_script_execution() {
        assert!(detect("node build.js").is_none());
    }

    #[test]
    fn skips_write_pattern_without_interpreter() {
        assert!(detect("grep -r 'writeFileSync' src/").is_none());
    }

    #[test]
    fn skips_word_containing_command_name() {
        assert!(detect("parsedump -i input.bin").is_none());
    }

    #[test]
    fn skips_command_name_inside_quotes() {
        // 引用符はコマンド名と同じ単語にくっつくため、
        // クォート内のコマンド名は検出対象にならない。
        assert!(detect("echo \"sed -i\"").is_none());
    }

    #[test]
    fn skips_unrelated_command() {
        assert!(detect("ls -la").is_none());
    }

    #[test]
    fn skips_empty() {
        assert!(detect("").is_none());
    }
}
