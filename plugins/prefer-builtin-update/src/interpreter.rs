//! スクリプト処理系の名前の判定。
//!
//! ファイル書き換えの検出とインラインスクリプトの検出で、
//! 処理系とみなす対象がずれないように判定を共有する。

/// スクリプト処理系の系統。
///
/// コマンドラインの文法が同じ処理系を1つにまとめる。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Interpreter {
    /// `python`や`pypy`や`ipython`。
    Python,
    /// Node.jsと、同じ形のフラグを持つBunやtsxなど。
    JavaScript,
    /// `deno eval`のようにサブコマンドでスクリプトの本文を取るDeno。
    Deno,
    Ruby,
    Perl,
}

/// `3`や`3.12`のようなバージョンの接尾辞か。空文字列も含む。
fn is_version_suffix(rest: &str) -> bool {
    rest.chars().all(|c| c.is_ascii_digit() || c == '.')
}

/// コマンド名からスクリプト処理系を判定する。
///
/// パスや引用符を外したコマンド名本体を受け取る。
/// Pythonは`python3.12`のようなバージョン付きの名前でも呼ばれるので接頭辞で判定する。
pub(crate) fn interpreter_of(name: &str) -> Option<Interpreter> {
    const PYTHON_NAMES: [&str; 3] = ["ipython", "python", "pypy"];
    let is_python = PYTHON_NAMES
        .iter()
        .any(|prefix| name.strip_prefix(prefix).is_some_and(is_version_suffix));
    if is_python {
        return Some(Interpreter::Python);
    }
    match name {
        "node" | "nodejs" | "bun" | "tsx" | "ts-node" => Some(Interpreter::JavaScript),
        "deno" => Some(Interpreter::Deno),
        "ruby" => Some(Interpreter::Ruby),
        "perl" => Some(Interpreter::Perl),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_python_names() {
        for name in [
            "python",
            "python3",
            "python3.12",
            "pypy",
            "pypy3",
            "ipython",
            "ipython3",
        ] {
            assert_eq!(interpreter_of(name), Some(Interpreter::Python), "{name}");
        }
    }

    #[test]
    fn classifies_javascript_names() {
        for name in ["node", "nodejs", "bun", "tsx", "ts-node"] {
            assert_eq!(
                interpreter_of(name),
                Some(Interpreter::JavaScript),
                "{name}"
            );
        }
    }

    #[test]
    fn classifies_other_interpreters() {
        assert_eq!(interpreter_of("deno"), Some(Interpreter::Deno));
        assert_eq!(interpreter_of("ruby"), Some(Interpreter::Ruby));
        assert_eq!(interpreter_of("perl"), Some(Interpreter::Perl));
    }

    #[test]
    fn rejects_names_only_starting_with_interpreter_name() {
        for name in [
            "python3Packages",
            "pythonw",
            "nodemon",
            "rubocop",
            "perldoc",
        ] {
            assert_eq!(interpreter_of(name), None, "{name}");
        }
    }

    #[test]
    fn rejects_unrelated_names() {
        assert_eq!(interpreter_of("bash"), None);
        assert_eq!(interpreter_of(""), None);
    }
}
