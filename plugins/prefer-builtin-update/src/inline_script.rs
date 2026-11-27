//! インラインスクリプトの即座実行の検出ロジック。
//!
//! `python3 -c`や`node -e`のように、
//! スクリプトの本文をコマンドラインや標準入力で処理系へ直接渡す実行を検出する。
//! ファイルへ書き込むかどうかは問わない。

use crate::detect::{Tok, basename, scan_io, tokenize};
use crate::interpreter::{Interpreter, interpreter_of};
use std::str::Chars;

/// スクリプト処理系のコマンドラインの文法。
///
/// どのフラグがスクリプトの本文を取り、
/// どのフラグが値を取るのかを処理系ごとに持つ。
/// 値を取るフラグを知らないと、
/// `python3 -W ignore -c ...`の`ignore`をスクリプトファイルと取り違えるため。
#[derive(Debug)]
struct Syntax {
    /// スクリプトの本文を取る短いフラグと、理由文に載せる表記。
    inline_short: &'static [(char, &'static str)],
    /// スクリプトの本文を取る長いフラグ。
    inline_long: &'static [&'static str],
    /// 実行するモジュールを取る短いフラグ。
    /// これより後ろはモジュールへの引数なので本文を取るフラグは現れない。
    module_short: &'static str,
    /// 値を取る短いフラグ。値は直後に繋げても次の単語に分けても書ける。
    value_short: &'static str,
    /// 値を直後に繋げて書く短いフラグ。結合フラグの残りは値なので読み飛ばす。
    attached_short: &'static str,
    /// 値を次の単語に取る長いフラグ。
    value_long: &'static [&'static str],
}

const PYTHON: Syntax = Syntax {
    inline_short: &[('c', "-c")],
    inline_long: &[],
    module_short: "m",
    value_short: "WX",
    attached_short: "",
    value_long: &["--check-hash-based-pycs"],
};

/// Node.jsと、同じ形のフラグを持つBunやtsxなどで共有する。
const JAVASCRIPT: Syntax = Syntax {
    inline_short: &[('e', "-e"), ('p', "-p")],
    inline_long: &["--eval", "--print"],
    module_short: "",
    value_short: "rC",
    attached_short: "",
    #[rustfmt::skip]
    value_long: &[
        "--require", "--import", "--loader", "--experimental-loader", "--conditions",
        "--env-file", "--preload", "--cwd", "--tsconfig", "--project",
    ],
};

const RUBY: Syntax = Syntax {
    inline_short: &[('e', "-e")],
    inline_long: &[],
    module_short: "",
    value_short: "rICE",
    attached_short: "FKTWx0",
    value_long: &[],
};

const PERL: Syntax = Syntax {
    inline_short: &[('e', "-e"), ('E', "-E")],
    inline_long: &[],
    module_short: "",
    value_short: "I",
    attached_short: "MmFxidDVC",
    value_long: &[],
};

/// 処理系のコマンドラインがスクリプトをどこから取るか。
#[derive(Debug, PartialEq, Eq)]
enum Invocation {
    /// コマンドラインの引数として本文を取る。中身は理由文に載せるフラグの表記。
    Inline(&'static str),
    /// `-`の指定で標準入力から本文を読む。
    Stdin,
    /// スクリプトファイルもモジュールも指定が無い。標準入力が繋がっていればそこから本文を読む。
    NoScript,
    /// スクリプトファイルやモジュールを実行する。
    Script,
}

/// 単語が指すスクリプト処理系。
#[derive(Debug)]
struct Target<'s> {
    /// 理由文に載せる処理系の名前。
    name: &'s str,
    interpreter: Interpreter,
    /// `nixpkgs#python3`のようなflakeの参照として書かれている。
    flake_reference: bool,
}

/// 単語がスクリプト処理系を指していればそれを返す。
///
/// コマンド名の位置にあるかは問わない。
/// `timeout 5 python3 -c`や`uv run python -c`のように、
/// 処理系を別のコマンド越しに起動する書き方が無数にあるため。
///
/// `bash -c "python3 -c ..."`のように引用符の直後に書かれた処理系も拾うため、
/// 先頭の引用符は外す。
/// エイリアスを避けるための先頭の`\`も外す。
///
/// `nix run nixpkgs#python3 -- -c ...`のようなflakeの参照は、
/// `#`の後ろの属性名で判定する。
/// 属性名は`nodejs_22`や`python313`のようにバージョンが付くことがあるので、
/// 末尾の数字と`_`は無視する。
fn interpreter_word(word: &str) -> Option<Target<'_>> {
    let word = word.trim_start_matches(['"', '\'', '\\']);
    if let Some((_, attribute)) = word.rsplit_once('#') {
        let base = attribute.trim_end_matches(|c: char| c.is_ascii_digit() || c == '_');
        return interpreter_of(base).map(|interpreter| Target {
            name: attribute,
            interpreter,
            flake_reference: true,
        });
    }
    let name = basename(word);
    interpreter_of(name).map(|interpreter| Target {
        name,
        interpreter,
        flake_reference: false,
    })
}

/// `after`(処理系の名前より後のトークン列)から、処理系への引数の単語を取り出す。
///
/// シェルメタ文字か改行までを処理系のコマンドとみなす。
/// 行末の`\`による行の継続は跨いで読み進める。
fn arguments<'s>(after: &[Tok<'s>]) -> Vec<&'s str> {
    let mut args = Vec::new();
    let mut continued = false;
    for tok in after {
        match tok {
            Tok::Punctuation(_) => break,
            Tok::Whitespace(s) => {
                if s.contains('\n') && !std::mem::take(&mut continued) {
                    break;
                }
            }
            Tok::Word("\\") => continued = true,
            Tok::Word(w) => {
                continued = false;
                args.push(*w);
            }
        }
    }
    args
}

/// フラグでスクリプトの本文を取る処理系への引数を分類する。
///
/// 最初に現れたフラグでない単語はスクリプトファイルで、
/// それより後ろはスクリプトへの引数なので見ない。
/// `python3 script.py -c config.toml`の`-c`を本文を取るフラグと取り違えないようにするため。
///
/// 短いフラグは`perl -ne`や`python3 -Ic`のように結合して書けるので1文字ずつ見る。
fn classify_flagged(syntax: &Syntax, args: &[&str]) -> Invocation {
    let mut args = args.iter().copied();
    while let Some(arg) = args.next() {
        if arg == "-" {
            return Invocation::Stdin;
        }
        if arg == "--" {
            // フラグの終わり。次の単語がスクリプトファイルで、無ければ標準入力から読む。
            return match args.next() {
                None => Invocation::NoScript,
                Some("-") => Invocation::Stdin,
                Some(_) => Invocation::Script,
            };
        }
        if arg.starts_with("--") {
            let (name, attached_value) = match arg.split_once('=') {
                Some((name, _)) => (name, true),
                None => (arg, false),
            };
            if let Some(flag) = syntax.inline_long.iter().find(|flag| **flag == name) {
                return Invocation::Inline(flag);
            }
            if !attached_value && syntax.value_long.contains(&name) {
                args.next();
            }
            continue;
        }
        let Some(cluster) = arg.strip_prefix('-') else {
            return Invocation::Script;
        };
        for (i, c) in cluster.char_indices() {
            if let Some((_, flag)) = syntax.inline_short.iter().find(|(short, _)| *short == c) {
                return Invocation::Inline(flag);
            }
            if syntax.module_short.contains(c) {
                return Invocation::Script;
            }
            if syntax.value_short.contains(c) {
                if cluster[i + c.len_utf8()..].is_empty() {
                    args.next();
                }
                break;
            }
            if syntax.attached_short.contains(c) {
                break;
            }
        }
    }
    Invocation::NoScript
}

/// 処理系への引数を分類する。
fn classify(interpreter: Interpreter, args: &[&str]) -> Invocation {
    match interpreter {
        Interpreter::Python => classify_flagged(&PYTHON, args),
        Interpreter::JavaScript => classify_flagged(&JAVASCRIPT, args),
        Interpreter::Ruby => classify_flagged(&RUBY, args),
        Interpreter::Perl => classify_flagged(&PERL, args),
        // Denoはフラグではなくサブコマンドでスクリプトの本文を取る。
        Interpreter::Deno => match args.iter().find(|arg| !arg.starts_with('-')) {
            Some(&"eval") => Invocation::Inline("eval"),
            _ => Invocation::Script,
        },
    }
}

/// flakeの参照として書かれた処理系への引数を分類する。
///
/// `nix run nixpkgs#python3 -- -c ...`のように、
/// 処理系への引数は`--`の後ろに書かれる。
/// `--`が無い場合は、
/// `nix shell nixpkgs#python3 -c python3 script.py`のように別のコマンドを取る形と区別するため、
/// フラグ以外の単語が続いていればスクリプトの実行とみなす。
fn classify_flake_reference(interpreter: Interpreter, args: &[&str]) -> Invocation {
    match args.iter().position(|arg| *arg == "--") {
        Some(separator) => classify(interpreter, &args[separator + 1..]),
        None if args.iter().all(|arg| arg.starts_with('-')) => Invocation::NoScript,
        None => Invocation::Script,
    }
}

/// 開き`"`の直後から閉じ`"`までを読み飛ばして、閉じ`"`があったかを返す。
fn skip_double_quoted(chars: &mut Chars) -> bool {
    while let Some(c) = chars.next() {
        match c {
            '"' => return true,
            '\\' => {
                chars.next();
            }
            _ => {}
        }
    }
    false
}

/// `before`(処理系の名前より前のコマンド文字列)の末尾がパイプで、
/// 処理系が標準入力をパイプから受け取る位置にあるか。
///
/// シェルの引用符を解釈して、
/// `rg "node|python|ruby"`のような引用符の中の`|`をパイプと取り違えないようにする。
/// 引用符が閉じないまま終わる場合は処理系の名前が引用符の中にあるので`false`を返す。
fn is_pipe_target(before: &str) -> bool {
    let mut chars = before.chars();
    // 引用符の外にある空白以外の直前の2文字。
    let mut last: Option<char> = None;
    let mut previous: Option<char> = None;
    while let Some(c) = chars.next() {
        let closed = match c {
            '\\' => {
                chars.next();
                true
            }
            '\'' => chars.by_ref().any(|c| c == '\''),
            '"' => skip_double_quoted(&mut chars),
            c if c.is_whitespace() => continue,
            _ => true,
        };
        if !closed {
            return false;
        }
        previous = last;
        last = Some(c);
    }
    match (previous, last) {
        // `||`はパイプではなく論理演算子。
        (Some('|'), Some('|')) => false,
        // `|&`は標準エラー出力も一緒に渡すパイプ。
        (Some('|'), Some('&')) | (_, Some('|')) => true,
        _ => false,
    }
}

/// 与えられたコマンド文字列からインラインスクリプトの即座実行を検出する。
///
/// 検出した場合は内容の英語説明文を返し、
/// 検出しなければ`None`を返す。
///
/// 以下のいずれかを即座実行とみなす。
///
/// - `python3 -c`や`node -e`のようにスクリプトの本文を引数で渡している
/// - `python3 -`のように標準入力から本文を読むことを明示している
/// - スクリプトファイルの指定が無く、ヒアドキュメントかパイプが標準入力に繋がっている
///
/// `python3 script.py`や`python3 -m pytest`のような、
/// スクリプトファイルやモジュールの実行は対象外。
pub fn detect_inline_script(command: &str) -> Option<String> {
    let tokens = tokenize(command);
    let mut end = 0;
    for (i, tok) in tokens.iter().enumerate() {
        let start = end;
        end += tok.byte_len();
        let Tok::Word(word) = tok else {
            continue;
        };
        let Some(target) = interpreter_word(word) else {
            continue;
        };
        let args = arguments(&tokens[i + 1..]);
        let invocation = if target.flake_reference {
            classify_flake_reference(target.interpreter, &args)
        } else {
            classify(target.interpreter, &args)
        };
        let name = target.name;
        let from_stdin = match invocation {
            Invocation::Inline(flag) => {
                return Some(format!("inline script execution with `{name} {flag}`"));
            }
            Invocation::Stdin => true,
            Invocation::NoScript => {
                scan_io(&command[end..]).reads_heredoc || is_pipe_target(&command[..start])
            }
            Invocation::Script => false,
        };
        if from_stdin {
            return Some(format!(
                "inline script execution by feeding a script to `{name}` through standard input"
            ));
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_python_command_flag() {
        // 理由文はユーザとモデルに提示されるため完全比較で固定する。
        assert_eq!(
            detect_inline_script("python3 -c \"print(open('config.json').read())\"").as_deref(),
            Some("inline script execution with `python3 -c`"),
        );
    }

    #[test]
    fn detects_every_python_name() {
        for name in [
            "python",
            "python3",
            "python3.12",
            "pypy",
            "pypy3",
            "ipython",
            "ipython3",
        ] {
            let command = format!("{name} -c 'print(1)'");
            assert!(
                detect_inline_script(&command).is_some(),
                "command {name} should be detected",
            );
        }
    }

    #[test]
    fn detects_python_with_path_prefix() {
        // パス付きでも理由文にはコマンド名本体だけが載る。
        assert_eq!(
            detect_inline_script("/usr/bin/python3 -c 'print(1)'").as_deref(),
            Some("inline script execution with `python3 -c`"),
        );
    }

    #[test]
    fn detects_python_combined_flags() {
        assert!(detect_inline_script("python3 -Ic 'print(1)'").is_some());
        assert!(detect_inline_script("python3 -uBc 'print(1)'").is_some());
    }

    #[test]
    fn detects_python_code_attached_to_flag() {
        assert!(detect_inline_script("python3 -c'print(1)'").is_some());
    }

    #[test]
    fn detects_python_after_other_flags() {
        assert!(detect_inline_script("python3 -u -B -c 'print(1)'").is_some());
    }

    #[test]
    fn detects_python_after_flags_with_values() {
        assert!(detect_inline_script("python3 -W ignore -c 'print(1)'").is_some());
        assert!(detect_inline_script("python3 -Wignore -X dev -c 'print(1)'").is_some());
        assert!(detect_inline_script("python3 -X importtime -c 'import json'").is_some());
    }

    #[test]
    fn detects_python_in_compound_command() {
        assert!(detect_inline_script("cd src && python3 -c 'print(1)'").is_some());
    }

    #[test]
    fn detects_python_in_pipeline() {
        let command = concat!(
            "curl -s https://example.com/a.json ",
            "| python3 -c 'import json,sys; print(json.load(sys.stdin))'",
        );
        assert!(detect_inline_script(command).is_some());
    }

    #[test]
    fn detects_python_in_command_substitution() {
        assert!(detect_inline_script("x=$(python3 -c 'print(1)')").is_some());
        assert!(detect_inline_script("echo \"$(python3 -c 'print(1)')\"").is_some());
    }

    #[test]
    fn detects_python_behind_wrapper_command() {
        for command in [
            "timeout 10 python3 -c 'print(1)'",
            "uv run python -c 'print(1)'",
            "uv run --with requests python -c 'import requests'",
            "poetry run python -c 'print(1)'",
            "env PYTHONPATH=src python3 -c 'print(1)'",
            "PYTHONPATH=src python3 -c 'print(1)'",
            "sudo -u root python3 -c 'print(1)'",
            "nix develop -c python -c 'print(1)'",
            "nix shell nixpkgs#python3 -c python3 -c 'print(1)'",
            "nix shell nixpkgs#python3 --command python3 -c 'print(1)'",
            "docker exec app python -c 'print(1)'",
        ] {
            assert!(
                detect_inline_script(command).is_some(),
                "{command} should be detected",
            );
        }
    }

    #[test]
    fn detects_python_inside_quoted_shell_command() {
        // 引用符の直後に書かれた処理系も検出する。
        for command in [
            "bash -c \"python3 -c 'print(1)'\"",
            "nix-shell -p python3 --run \"python3 -c 'print(1)'\"",
            "ssh host 'python3 -c \"print(1)\"'",
        ] {
            assert!(
                detect_inline_script(command).is_some(),
                "{command} should be detected",
            );
        }
    }

    #[test]
    fn detects_python_flake_reference() {
        assert_eq!(
            detect_inline_script("nix run nixpkgs#python3 -- -c 'print(1)'").as_deref(),
            Some("inline script execution with `python3 -c`"),
        );
        assert!(detect_inline_script("nix run nixpkgs#python313 -- -c 'print(1)'").is_some());
        assert!(
            detect_inline_script("nix run --impure nixpkgs#python3 -- -Ic 'print(1)'").is_some()
        );
    }

    #[test]
    fn detects_python_after_line_continuation() {
        assert!(detect_inline_script("python3 \\\n  -c 'print(1)'").is_some());
    }

    #[test]
    fn detects_python_explicit_stdin() {
        assert_eq!(
            detect_inline_script("python3 - <<'EOF'\nprint(1)\nEOF").as_deref(),
            Some("inline script execution by feeding a script to `python3` through standard input"),
        );
        assert!(detect_inline_script("echo 'print(1)' | python3 -").is_some());
        assert!(detect_inline_script("python3 - arg <<'EOF'\nprint(1)\nEOF").is_some());
    }

    #[test]
    fn detects_python_heredoc() {
        assert!(detect_inline_script("python3 <<'EOF'\nprint(1)\nEOF").is_some());
        assert!(detect_inline_script("python3 <<EOF\nprint(1)\nEOF").is_some());
        assert!(detect_inline_script("python3 -u <<-EOF\n\tprint(1)\nEOF").is_some());
    }

    #[test]
    fn detects_python_herestring() {
        assert!(detect_inline_script("python3 <<< 'print(1)'").is_some());
    }

    #[test]
    fn detects_python_heredoc_behind_wrapper_command() {
        assert!(detect_inline_script("uv run python <<'EOF'\nprint(1)\nEOF").is_some());
        assert!(detect_inline_script("timeout 10 python3 <<'EOF'\nprint(1)\nEOF").is_some());
        assert!(detect_inline_script("nix run nixpkgs#python3 <<'EOF'\nprint(1)\nEOF").is_some());
    }

    #[test]
    fn detects_python_piped_script() {
        assert!(detect_inline_script("echo 'print(1)' | python3").is_some());
        assert!(detect_inline_script("echo 'print(1)' |& python3").is_some());
        assert!(detect_inline_script("printf 'print(1)\\n' | python3 -u").is_some());
    }

    #[test]
    fn skips_piped_script_behind_wrapper_command_as_false_negative() {
        // パイプの判定は処理系の名前の直前しか見ないので、
        // 別のコマンド越しの処理系へパイプで渡された本文は見逃す。
        // READMEの「位置づけと限界」で許容と明記した挙動を固定する。
        for command in [
            "echo 'print(1)' | uv run python",
            "echo 'print(1)' | timeout 5 python3",
            "echo 'print(1)' | nix run nixpkgs#python3",
        ] {
            assert!(
                detect_inline_script(command).is_none(),
                "{command} should be skipped",
            );
        }
    }

    #[test]
    fn detects_node_eval() {
        assert_eq!(
            detect_inline_script("node -e 'console.log(1)'").as_deref(),
            Some("inline script execution with `node -e`"),
        );
        assert_eq!(
            detect_inline_script("node --eval 'console.log(1)'").as_deref(),
            Some("inline script execution with `node --eval`"),
        );
        assert!(detect_inline_script("node --eval='console.log(1)'").is_some());
    }

    #[test]
    fn detects_node_print() {
        assert_eq!(
            detect_inline_script("node -p 'process.version'").as_deref(),
            Some("inline script execution with `node -p`"),
        );
        assert!(detect_inline_script("node --print 'process.version'").is_some());
        assert!(detect_inline_script("node -pe 'process.version'").is_some());
    }

    #[test]
    fn detects_node_after_flags_with_values() {
        assert!(detect_inline_script("node -r ./setup.js -e 'console.log(1)'").is_some());
        assert!(detect_inline_script("node --require ./setup.js -e 'console.log(1)'").is_some());
        assert!(detect_inline_script("node --input-type=module -e 'console.log(1)'").is_some());
    }

    #[test]
    fn detects_node_heredoc() {
        assert!(detect_inline_script("node <<'EOF'\nconsole.log(1)\nEOF").is_some());
        assert!(
            detect_inline_script("node --input-type=module <<'EOF'\nconsole.log(1)\nEOF").is_some()
        );
    }

    #[test]
    fn detects_every_javascript_runtime() {
        for name in ["node", "nodejs", "bun", "tsx", "ts-node"] {
            let command = format!("{name} -e 'console.log(1)'");
            assert!(
                detect_inline_script(&command).is_some(),
                "command {name} should be detected",
            );
        }
    }

    #[test]
    fn detects_node_flake_reference_with_version() {
        assert!(detect_inline_script("nix run nixpkgs#nodejs_22 -- -e 'console.log(1)'").is_some());
    }

    #[test]
    fn detects_deno_eval() {
        assert_eq!(
            detect_inline_script("deno eval 'console.log(1)'").as_deref(),
            Some("inline script execution with `deno eval`"),
        );
    }

    #[test]
    fn detects_deno_eval_after_global_flag() {
        // サブコマンドの前に置かれたフラグは読み飛ばす。
        assert!(detect_inline_script("deno -q eval 'console.log(1)'").is_some());
    }

    #[test]
    fn skips_deno_stdin_script_as_false_negative() {
        // Denoは`deno eval`だけを検出するので標準入力で渡された本文は見逃す。
        // READMEの「位置づけと限界」で許容と明記した挙動を固定する。
        assert!(detect_inline_script("echo 'console.log(1)' | deno").is_none());
        assert!(detect_inline_script("deno run - <<'EOF'\nconsole.log(1)\nEOF").is_none());
    }

    #[test]
    fn detects_ruby_eval() {
        assert_eq!(
            detect_inline_script("ruby -e 'puts 1'").as_deref(),
            Some("inline script execution with `ruby -e`"),
        );
        assert!(detect_inline_script("ruby -ne 'print if /x/' a.txt").is_some());
        assert!(detect_inline_script("ruby -rjson -e 'puts 1'").is_some());
        assert!(detect_inline_script("ruby -r json -e 'puts 1'").is_some());
    }

    #[test]
    fn detects_perl_eval() {
        assert_eq!(
            detect_inline_script("perl -e 'print 1'").as_deref(),
            Some("inline script execution with `perl -e`"),
        );
        assert_eq!(
            detect_inline_script("perl -E 'say 1'").as_deref(),
            Some("inline script execution with `perl -E`"),
        );
        assert!(detect_inline_script("perl -ne 'print if /x/' a.txt").is_some());
        assert!(detect_inline_script("perl -lane 'print $F[0]' a.txt").is_some());
        assert!(detect_inline_script("perl -MJSON::PP -e 'print 1'").is_some());
        assert!(detect_inline_script("perl -0777 -ne 'print' a.txt").is_some());
    }

    #[test]
    fn skips_python_script_execution() {
        assert!(detect_inline_script("python3 script.py").is_none());
        assert!(detect_inline_script("python3 -u script.py").is_none());
        assert!(detect_inline_script("uv run python script.py").is_none());
        assert!(detect_inline_script("nix run nixpkgs#python3 -- script.py").is_none());
    }

    #[test]
    fn skips_flag_of_python_script() {
        // スクリプトファイルより後ろはスクリプトへの引数。
        assert!(detect_inline_script("python3 script.py -c config.toml").is_none());
        assert!(detect_inline_script("python3 -W ignore script.py -c config.toml").is_none());
        assert!(detect_inline_script("python3 script.py -").is_none());
    }

    #[test]
    fn skips_python_module_execution() {
        assert!(detect_inline_script("python3 -m pytest").is_none());
        // モジュールより後ろはモジュールへの引数。
        assert!(detect_inline_script("python3 -m pytest -c pytest.ini").is_none());
        assert!(detect_inline_script("python3 -um pytest -c pytest.ini").is_none());
    }

    #[test]
    fn skips_python_script_reading_piped_data() {
        // スクリプトファイルやモジュールがあれば標準入力はデータ。
        assert!(detect_inline_script("cat a.json | python3 -m json.tool").is_none());
        assert!(detect_inline_script("cat a.json | python3 script.py").is_none());
        assert!(detect_inline_script("python3 script.py <<'EOF'\ndata\nEOF").is_none());
    }

    #[test]
    fn skips_python_version() {
        assert!(detect_inline_script("python3 --version").is_none());
        assert!(detect_inline_script("python3 -V").is_none());
    }

    #[test]
    fn skips_python_script_from_file_redirect() {
        assert!(detect_inline_script("python3 < script.py").is_none());
    }

    #[test]
    fn skips_interpreter_name_as_argument() {
        for command in [
            "which python3",
            "command -v python3",
            "nix build .#python3",
            "nix shell nixpkgs#python3 nixpkgs#jq -c jq . a.json",
            "ls /usr/bin/python3",
            "grep -rn python src/",
            "rg -c python",
        ] {
            assert!(
                detect_inline_script(command).is_none(),
                "{command} should be skipped",
            );
        }
    }

    #[test]
    fn skips_interpreter_name_after_pipe_inside_quotes() {
        // 引用符の中の`|`はパイプではなく検索パターン。
        assert!(detect_inline_script("rg \"node|python|ruby\" src/").is_none());
        assert!(detect_inline_script("rg 'node|python|ruby' src/").is_none());
    }

    #[test]
    fn skips_interpreter_name_after_or_operator() {
        assert!(detect_inline_script("test -x venv/bin/python || python3").is_none());
    }

    #[test]
    fn skips_node_script_execution() {
        assert!(detect_inline_script("node build.js").is_none());
        assert!(detect_inline_script("node --require ./setup.js build.js -e production").is_none());
        assert!(detect_inline_script("node --version").is_none());
        assert!(detect_inline_script("bun install -p").is_none());
        assert!(detect_inline_script("bun run build").is_none());
    }

    #[test]
    fn skips_deno_script_execution() {
        assert!(detect_inline_script("deno run -A main.ts").is_none());
        assert!(detect_inline_script("deno --version").is_none());
    }

    #[test]
    fn skips_ruby_and_perl_script_execution() {
        assert!(detect_inline_script("ruby script.rb -e production").is_none());
        assert!(detect_inline_script("ruby -Ilib script.rb").is_none());
        assert!(detect_inline_script("perl script.pl -e production").is_none());
        assert!(detect_inline_script("perl -Ilib script.pl").is_none());
        assert!(detect_inline_script("perl -v").is_none());
    }

    #[test]
    fn detects_stdin_script_after_option_terminator() {
        // `--`の後ろにスクリプトファイルが無ければ標準入力から本文を読む。
        assert!(detect_inline_script("python3 -- <<'EOF'\nprint(1)\nEOF").is_some());
        assert!(detect_inline_script("echo 'print(1)' | python3 --").is_some());
        assert!(detect_inline_script("python3 -- - <<'EOF'\nprint(1)\nEOF").is_some());
    }

    #[test]
    fn skips_script_after_option_terminator() {
        // `--`の後ろの単語はスクリプトファイルで、それより後ろはスクリプトへの引数。
        assert!(detect_inline_script("node -- script.js -e x").is_none());
        assert!(detect_inline_script("python3 -- script.py -c config.toml").is_none());
        assert!(detect_inline_script("cat a.json | python3 -- script.py").is_none());
    }

    #[test]
    fn skips_shell_command_string() {
        // シェル自身の`-c`は対象外。
        assert!(detect_inline_script("bash -c 'ls -la'").is_none());
    }

    #[test]
    fn skips_command_on_next_line() {
        // 改行より後ろは別のコマンド。
        assert!(detect_inline_script("which python3\nrg -c foo src/").is_none());
    }

    #[test]
    fn detects_interpreter_name_in_message_as_false_positive() {
        // クォートを解釈しないため文章の中の言及でも誤検知として検出される。
        // READMEの「位置づけと限界」で許容と明記した挙動を固定する。
        assert!(detect_inline_script("git commit -m \"reject python3 -c one-liners\"").is_some());
    }

    #[test]
    fn detects_flag_after_search_word_as_false_positive() {
        // 処理系の名前を検索語にして後ろへフラグを書くと誤検知として検出される。
        // READMEの「位置づけと限界」で許容と明記した挙動を固定する。
        assert!(detect_inline_script("rg python -c").is_some());
    }

    #[test]
    fn skips_unrelated_command() {
        assert!(detect_inline_script("ls -la").is_none());
    }

    #[test]
    fn skips_empty() {
        assert!(detect_inline_script("").is_none());
    }
}
