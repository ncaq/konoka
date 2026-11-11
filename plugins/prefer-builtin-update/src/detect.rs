//! ファイル書き換えコマンドの検出ロジック。

use std::iter::Peekable;
use std::str::Chars;
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

impl Tok<'_> {
    /// 元のコマンド文字列上でこのトークンが占めるバイト長。
    fn byte_len(&self) -> usize {
        match self {
            Tok::Whitespace(s) | Tok::Word(s) => s.len(),
            Tok::Punctuation(c) => c.len_utf8(),
        }
    }
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

/// コマンド文字列をトークン列に分割する。
///
/// 任意の文字は空白・シェルメタ文字・その他のいずれかとして必ず消費されるため、
/// このパースは失敗しない。
fn tokenize(input: &str) -> Vec<Tok<'_>> {
    repeat(0.., token)
        .parse(input)
        .expect("every character should be consumed as whitespace, punctuation, or word")
}

/// パス付きで書かれたコマンド名からコマンド名本体を取り出す。
fn basename(word: &str) -> &str {
    word.rsplit('/').next().unwrap_or(word)
}

/// in-place編集フラグ(`-i`)を持ちうるコマンドか。
///
/// sedはコマンドごと拒否するが、
/// `sudo -u root sed -i`のようにコマンド名の位置と判定できない場合に備えて残す。
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

/// `open(`の引数の中に現れたら書き込みとみなす文字列。
///
/// PythonやRubyの`open("file", "w")`形式の書き込みモードと、
/// Perlの`open($fh, '>', "file")`形式の書き込みリダイレクトに対応する。
///
/// `open('albums.json')`のようなファイル名を誤検出しないように、
/// モードは引用符で閉じた完全な文字列のみを対象にする。
/// ただし`open('a')`のようにファイル名がモード文字そのものの場合は誤検出する。
/// 誤検知を厳密に潰すよりワンライナー抑止側へ倒す方針なので許容している。
///
/// Perl形式の`'>`と`">`は閉じ引用符を要求しないため、
/// `">"`との比較式のような無関係な並びにも一致する限界がある。
///
/// 検索対象はコンパイル時に確定するため、
/// 実行時に引用符とモードを組み立てずに静的な配列として持つ。
#[rustfmt::skip]
const WRITE_OPEN_PATTERNS: [&str; 44] = [
    "'w'", "'a'", "'x'", "'wb'", "'ab'", "'xb'", "'wt'", "'at'", "'xt'",
    "'w+'", "'a+'", "'x+'", "'r+'", "'w+b'", "'a+b'", "'x+b'", "'r+b'",
    "'rb+'", "'wb+'", "'ab+'", "'xb+'",
    "\"w\"", "\"a\"", "\"x\"", "\"wb\"", "\"ab\"", "\"xb\"", "\"wt\"", "\"at\"", "\"xt\"",
    "\"w+\"", "\"a+\"", "\"x+\"", "\"r+\"", "\"w+b\"", "\"a+b\"", "\"x+b\"", "\"r+b\"",
    "\"rb+\"", "\"wb+\"", "\"ab+\"", "\"xb+\"",
    "'>", "\">",
];

/// `open(`の引数部分に書き込みモードの指定があるか。
fn open_args_have_write_mode(args: &str) -> bool {
    WRITE_OPEN_PATTERNS.iter().any(|p| args.contains(p))
}

/// `open(`の後ろから対応する閉じ括弧までの引数部分を取り出す。
///
/// 引数に`os.path.expanduser('~/a')`のような関数呼び出しが入れ子になっていても、
/// 括弧の深さを数えて対応する`)`までを引数として扱う。
/// 対応する`)`が無い場合は末尾までを引数とみなす。
fn open_call_args(rest: &str) -> &str {
    let mut depth: usize = 0;
    for (i, c) in rest.char_indices() {
        match c {
            '(' => depth += 1,
            ')' => {
                if depth == 0 {
                    return &rest[..i];
                }
                depth -= 1;
            }
            _ => {}
        }
    }
    rest
}

/// コマンド文字列のどこかに現れたら書き込みとみなすメソッド名や関数名。
///
/// `(`を付けていないパターンは、
/// `writeFileSync`や`File.binwrite`のような同期版・非同期版などの派生形を、
/// 前方一致で拾うための意図的な形。
#[rustfmt::skip]
const WRITE_CALL_PATTERNS: [&str; 9] = [
    // pathlibなどの書き込みメソッド。
    "write_text(", "write_bytes(",
    // Node.jsのfsモジュールの書き込み関数。
    "writeFile", "appendFile", "createWriteStream",
    // Rubyの書き込みメソッド。
    "File.write", "File.binwrite", "IO.write", "IO.binwrite",
];

/// コマンド文字列全体にファイル書き込みを示すパターンがあるか。
///
/// `-c`や`-e`のワンライナーに限らずヒアドキュメントで渡されたコードも、
/// コマンド文字列全体を見ることで同時にカバーする。
///
/// パターンごとの`contains`による素朴な線形走査を繰り返す。
/// 入力は1回のBashツール呼び出しのコマンド文字列で高々数KB程度という前提で、
/// この規模なら走査回数を最適化しても差は観測できない。
fn has_write_pattern(command: &str) -> bool {
    WRITE_CALL_PATTERNS.iter().any(|p| command.contains(p))
        // `open(`の引数に書き込みモードがあるか。
        || command.match_indices("open(").any(|(i, matched)| {
            open_args_have_write_mode(open_call_args(&command[i + matched.len()..]))
        })
}

/// 単語からコマンド名本体を取り出す。
///
/// パスに加えて、
/// エイリアスを避けるための`\sed`の先頭の`\`も外す。
///
/// 引用符や末尾の`\`は外さない。
/// トークン列は引用符を解釈しないため、
/// `grep 'foo\|sed'`の`sed'`や`jq 'test("awk")'`の`"awk"`のような、
/// 引用符の中で区切り文字の直後に来た単語をコマンド名と取り違えないようにするため。
fn command_name(word: &str) -> &str {
    basename(word.strip_prefix('\\').unwrap_or(word))
}

/// 用途を問わずコマンドごと拒否するコマンドの名前か。
///
/// sedとawkはファイルの書き換えに使われることがほとんどで、
/// in-place編集のフラグを封じても、
/// 一時ファイルへ出力してから`cp`で書き戻すような方法で同じことができてしまう。
/// 書き換えの方法を個別に追いかけずに、
/// コマンドそのものを拒否する。
fn is_rejected_command(name: &str) -> bool {
    matches!(name, "sed" | "gsed" | "awk" | "gawk" | "mawk" | "nawk")
}

/// コマンドごと拒否したことの説明。
///
/// 読み取り専用の用途も拒否するため、
/// よく使われる`sed -n`による範囲表示の代わりの手段を添える。
const REJECTED_COMMAND_NOTE: &str = concat!(
    "which is rejected regardless of its purpose ",
    "(to view part of a file, use the Read tool with offset and limit instead)",
);

/// 出力をファイルへ書き込むと書き換えとみなすコマンドの名前か。
///
/// 検索や読み取りにも日常的に使うためコマンドごとは拒否しないが、
/// `grep -v`で行を消した結果を一時ファイルへ出力して書き戻すような使い方を止める。
fn is_filter_command(name: &str) -> bool {
    matches!(name, "grep" | "egrep" | "fgrep")
}

/// 後ろに別のコマンドを取るコマンドや予約語。
///
/// これらの後ろの単語も引き続きコマンド名の位置にあるものとして扱う。
/// `xargs -0 sed`のように直後に続く`-`で始まるオプションは読み飛ばすが、
/// `sudo -u root sed`のようなオプションの値はコマンド名と区別できない。
#[rustfmt::skip]
const COMMAND_PREFIXES: [&str; 20] = [
    "env", "sudo", "doas", "command", "builtin", "exec", "nice", "nohup", "time", "xargs",
    "stdbuf", "busybox",
    "if", "then", "elif", "else", "while", "until", "do", "!",
];

/// findで後ろにコマンドを取るオプション。
const FIND_EXEC_OPTIONS: [&str; 4] = ["-exec", "-execdir", "-ok", "-okdir"];

/// `NAME=value`形式の変数代入か。
fn is_assignment(word: &str) -> bool {
    word.split_once('=').is_some_and(|(name, _)| {
        let mut chars = name.chars();
        chars
            .next()
            .is_some_and(|c| c.is_ascii_alphabetic() || c == '_')
            && chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
    })
}

/// コマンド名の位置にある単語と、
/// 元のコマンド文字列上でその単語の直後に当たるバイト位置を列挙する。
///
/// 先頭と、`;`や`&&`や`|`や`(`や改行のようなコマンドの区切りの直後が、
/// コマンド名の位置になる。
/// 変数代入や`COMMAND_PREFIXES`の後ろも引き続きコマンド名の位置として扱う。
/// `>`や`<`の直後の単語はリダイレクト先なのでコマンド名にはならない。
/// `>&`や`&>`の`&`はリダイレクト演算子の一部なので区切りとみなさない。
///
/// トークン列はシェルの引用符を解釈しないため、
/// 引用符の中でも区切り文字の直後の単語はコマンド名の位置とみなされる。
/// トークンは元の文字列を隙間なく分割したものなので、
/// トークンのバイト長を積算すれば元の文字列上の位置が分かる。
fn command_words<'s>(tokens: &[Tok<'s>]) -> Vec<(&'s str, usize)> {
    let mut words = Vec::new();
    let mut end = 0;
    let mut expecting = true;
    let mut after_prefix = false;
    let mut redirect_target = false;
    for (i, tok) in tokens.iter().enumerate() {
        end += tok.byte_len();
        match tok {
            Tok::Whitespace(s) => {
                if s.contains('\n') {
                    expecting = true;
                    after_prefix = false;
                }
            }
            Tok::Punctuation('<' | '>') => redirect_target = true,
            Tok::Punctuation('&')
                if redirect_target || matches!(tokens.get(i + 1), Some(Tok::Punctuation('>'))) => {}
            Tok::Punctuation(_) => {
                expecting = true;
                after_prefix = false;
                redirect_target = false;
            }
            Tok::Word(w) => {
                if std::mem::take(&mut redirect_target) {
                    continue;
                }
                if !expecting {
                    expecting = FIND_EXEC_OPTIONS.contains(w);
                    continue;
                }
                if is_assignment(w) || (after_prefix && w.starts_with('-')) {
                    continue;
                }
                words.push((*w, end));
                after_prefix = COMMAND_PREFIXES.contains(&command_name(w));
                expecting = after_prefix;
            }
        }
    }
    words
}

/// 出力先にしてもファイルの書き換えにならない特殊ファイル。
const HARMLESS_OUTPUT_TARGETS: [&str; 4] = ["/dev/null", "/dev/stdout", "/dev/stderr", "/dev/tty"];

/// 開き`"`の直後から閉じ`"`までを読み進めて中身を返す。
///
/// シェルのダブルクォートの中で`\`がエスケープになるのは一部の文字だけだが、
/// 出力先の判定には影響しないので、
/// `\`は種類を問わず次の1文字をエスケープするものとして扱う。
fn read_double_quoted(chars: &mut Peekable<Chars>) -> String {
    let mut content = String::new();
    while let Some(c) = chars.next() {
        match c {
            '"' => break,
            '\\' => content.extend(chars.next()),
            c => content.push(c),
        }
    }
    content
}

/// 空白とタブを読み飛ばしてから、
/// 引用符を外しながらシェルの単語を1つ読み進めて返す。
///
/// 空白やシェルメタ文字の手前で止まり、それらは消費しない。
/// 単語が無ければ空文字列を返す。
fn read_shell_word(chars: &mut Peekable<Chars>) -> String {
    while chars.next_if(|&c| c == ' ' || c == '\t').is_some() {}
    let mut word = String::new();
    while let Some(c) = chars.next_if(|&c| !is_shell_special(c)) {
        match c {
            '\'' => word.extend(chars.by_ref().take_while(|&c| c != '\'')),
            '"' => word.push_str(&read_double_quoted(chars)),
            '\\' => word.extend(chars.next()),
            c => word.push(c),
        }
    }
    word
}

/// 出力先の名前が通常のファイルを指すか。
fn is_file_target(target: &str) -> bool {
    !target.is_empty() && !HARMLESS_OUTPUT_TARGETS.contains(&target)
}

/// `>`の直後から、
/// リダイレクト演算子の残りと出力先を読み進めて、
/// 出力先が通常のファイルか判定する。
///
/// `>&2`のようなファイル記述子の複製と`>(...)`のようなプロセス置換、
/// `/dev/null`のような特殊ファイルは書き換えではないので`false`を返す。
/// プロセス置換の`(`は呼び出し元で括弧の深さを数えるために消費しない。
fn redirect_target_is_file(chars: &mut Peekable<Chars>) -> bool {
    // `>>`による追記と`>|`による強制上書きの2文字目。
    chars.next_if(|&c| c == '>' || c == '|');
    if chars.next_if_eq(&'&').is_some() {
        // 複製先のファイル記述子番号や`-`。
        while chars.next_if(|&c| !is_shell_special(c)).is_some() {}
        return false;
    }
    if chars.peek() == Some(&'(') {
        return false;
    }
    is_file_target(&read_shell_word(chars))
}

/// パイプの直後から後続コマンドの名前と引数を読み進めて、
/// `tee`や`sponge`のように標準入力をファイルへ書き込むコマンドか判定する。
///
/// 書き込むコマンドでなければコマンド名だけを消費して`false`を返す。
fn pipes_into_file_writer(chars: &mut Peekable<Chars>) -> bool {
    let name = read_shell_word(chars);
    if !matches!(basename(&name), "tee" | "sponge") {
        return false;
    }
    loop {
        let arg = read_shell_word(chars);
        if arg.is_empty() {
            return false;
        }
        if !arg.starts_with('-') && is_file_target(&arg) {
            return true;
        }
    }
}

/// コマンド名より後ろを走査して分かった、
/// そのコマンドの入出力の性質。
#[derive(Debug, Default)]
struct IoScan {
    /// 出力がファイルへ書き込まれる。
    writes_file: bool,
    /// コマンド自身の標準入力がヒアドキュメントかヒアストリング。
    reads_heredoc: bool,
}

/// `rest`(コマンド名より後ろのコマンド文字列)から、
/// そのコマンドの出力がファイルへ書き込まれるかと、
/// 標準入力がヒアドキュメントかを調べる。
///
/// トークン列と違いシェルの引用符を解釈しながら、
/// コマンドを含むパイプラインの終わり(`;`や`&&`や`||`や改行など)まで走査する。
/// `grep 'a > b'`のような引数の中の`>`を、
/// シェルのリダイレクトと取り違えないようにするため。
///
/// 以下のいずれかをファイルへの書き込みとみなす。
///
/// - 引用符の外のリダイレクト(`>`や`>>`や`>|`や`&>`)で標準出力をファイルへ向けている
/// - パイプで繋いだ`tee`や`sponge`でファイルへ書き込んでいる
///
/// 出力を`sort`などの別コマンドに通してからリダイレクトする場合も、
/// 書き込まれる内容は元のコマンドが作ったものなので、
/// パイプでは止まらずにパイプラインの最後まで見る。
///
/// 書き換えの結果を一時ファイルへ出力してから`cp`や`mv`で書き戻す手口を、
/// 書き戻し側の書き方に依らず止めるため、
/// 書き戻しの有無は見ずにファイルへの出力そのものを検出する。
/// `2>`のような標準出力以外のリダイレクトは対象外。
///
/// ヒアドキュメント(`<<`)とヒアストリング(`<<<`)は、
/// 最初のパイプより前にあるものだけをコマンド自身の入力とみなす。
/// ヒアドキュメントの本文は改行の後ろにあり走査の対象外なので、
/// `cat > a.txt <<'EOF'`と`cat <<'EOF' > a.txt`のどちらの順でも、
/// 開始行だけを見て判定できる。
///
/// 括弧の深さを数えるので`<(...)`のようなプロセス置換の中の区切り文字では止まらず、
/// コマンド自身が`$(...)`の中にある場合はその閉じ括弧で止まる。
fn scan_io(rest: &str) -> IoScan {
    let mut scan = IoScan::default();
    let mut chars = rest.chars().peekable();
    let mut depth: usize = 0;
    // 最初のパイプより前のコマンド自身の引数を走査しているか。
    let mut in_own_args = true;
    // 直前の2文字。`2>`のようなファイル記述子番号付きのリダイレクトの判別に使う。
    let mut prev: Option<char> = None;
    let mut prev2: Option<char> = None;
    while let Some(c) = chars.next() {
        match c {
            '\\' => {
                chars.next();
            }
            '\'' => {
                chars.by_ref().find(|&c| c == '\'');
            }
            '"' => {
                read_double_quoted(&mut chars);
            }
            '(' => depth += 1,
            ')' => match depth.checked_sub(1) {
                Some(d) => depth = d,
                None => break,
            },
            ';' | '\n' | '`' if depth == 0 => break,
            '|' if depth == 0 => {
                if chars.next_if_eq(&'|').is_some() {
                    break;
                }
                // `|&`は標準エラー出力も一緒に渡すパイプ。
                chars.next_if_eq(&'&');
                in_own_args = false;
                if pipes_into_file_writer(&mut chars) {
                    scan.writes_file = true;
                }
            }
            '&' => {
                // `&>`と`&>>`は標準出力と標準エラー出力の両方をファイルへ向ける。
                if chars.next_if_eq(&'>').is_some() {
                    if redirect_target_is_file(&mut chars) {
                        scan.writes_file = true;
                    }
                } else if depth == 0 {
                    break;
                }
            }
            // `<<`と`<<<`。
            // 単独の`<`による入力のリダイレクトと`<(...)`のプロセス置換は対象外。
            '<' if depth == 0 && in_own_args && chars.next_if_eq(&'<').is_some() => {
                scan.reads_heredoc = true;
            }
            '>' => {
                let fd_number = prev.is_some_and(|p| p.is_ascii_digit())
                    && prev2.is_none_or(char::is_whitespace);
                let stdout = !fd_number || prev == Some('1');
                if redirect_target_is_file(&mut chars) && stdout {
                    scan.writes_file = true;
                }
            }
            _ => {}
        }
        prev2 = prev;
        prev = Some(c);
    }
    scan
}

/// コマンド名の位置にある単語から、
/// コマンドごと拒否するコマンドと、
/// 出力をファイルへ書き込む書き換え用途のコマンドと、
/// catとヒアドキュメントによるファイルの作成を検出する。
fn detect_command(command: &str, tokens: &[Tok]) -> Option<String> {
    for (word, end) in command_words(tokens) {
        let name = command_name(word);
        if is_rejected_command(name) {
            return Some(format!("use of `{name}`, {REJECTED_COMMAND_NOTE}"));
        }
        if is_filter_command(name) && scan_io(&command[end..]).writes_file {
            return Some(format!("`{name}` output written to files"));
        }
        if name == "cat" {
            let scan = scan_io(&command[end..]);
            if scan.writes_file && scan.reads_heredoc {
                return Some("writing files with `cat` and a heredoc".to_owned());
            }
        }
    }
    None
}

/// 与えられたコマンド文字列からファイル書き換えを検出する。
///
/// 検出した場合は内容の英語説明文を返し、
/// 検出しなければ`None`を返す。
pub fn detect(command: &str) -> Option<String> {
    let tokens = tokenize(command);

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

    // sedとawkの使用と、grepなどの出力のファイルへの書き込みと、
    // catとヒアドキュメントによるファイルの作成。
    if let Some(detected) = detect_command(command, &tokens) {
        return Some(detected);
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
        // 理由文はユーザとモデルに提示されるため、
        // コマンド名の取り違えが起きないことを完全比較で固定する。
        assert_eq!(
            detect("perl -i -pe 's/foo/bar/' README.md").as_deref(),
            Some("`perl -i` style in-place file editing"),
        );
    }

    #[test]
    fn detects_perl_inplace_combined_flags() {
        assert!(detect("perl -pi -e 's/foo/bar/' README.md").is_some());
    }

    #[test]
    fn detects_ruby_inplace() {
        assert_eq!(
            detect("ruby -i -pe 'gsub(/foo/, \"bar\")' README.md").as_deref(),
            Some("`ruby -i` style in-place file editing"),
        );
    }

    #[test]
    fn detects_inplace_in_compound_command() {
        assert!(detect("cd src && sed -i 's/foo/bar/' main.rs").is_some());
    }

    #[test]
    fn detects_inplace_with_path_prefix() {
        // パス付きでも理由文にはコマンド名本体だけが載る。
        assert_eq!(
            detect("/usr/bin/sed -i 's/foo/bar/' main.rs").as_deref(),
            Some("`sed -i` style in-place file editing"),
        );
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
    fn detects_python_open_exclusive_create_mode() {
        assert!(detect("python3 -c \"open('out.txt', 'x').write('data')\"").is_some());
    }

    #[test]
    fn detects_python_open_reversed_binary_update_mode() {
        assert!(detect("python3 -c \"open('a.bin', 'rb+').write(b'x')\"").is_some());
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
        assert_eq!(
            detect("node -e 'require(\"fs\").writeFileSync(\"a.txt\", \"x\")'").as_deref(),
            Some("a `node` one-liner that writes to files"),
        );
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
    fn detects_every_write_call_pattern() {
        for pattern in WRITE_CALL_PATTERNS {
            let command = format!("python3 -c \"{pattern}\"");
            assert!(
                detect(&command).is_some(),
                "pattern {pattern} should be detected",
            );
        }
    }

    #[test]
    fn detects_every_write_open_pattern() {
        for pattern in WRITE_OPEN_PATTERNS {
            let command = format!("python3 -c \"open('file', {pattern})\"");
            assert!(
                detect(&command).is_some(),
                "pattern {pattern} should be detected",
            );
        }
    }

    #[test]
    fn detects_sed_read_only() {
        // 読み取り専用の用途でもコマンドごと拒否する。
        // 理由文に検出したコマンド名とReadツールへの誘導が載ることを完全比較で固定する。
        assert_eq!(
            detect("sed -n '1,10p' src/main.rs").as_deref(),
            Some(concat!(
                "use of `sed`, which is rejected regardless of its purpose ",
                "(to view part of a file, use the Read tool with offset and limit instead)",
            )),
        );
    }

    #[test]
    fn detects_sed_pipe_filter() {
        assert!(detect("cat log.txt | sed 's/foo/bar/'").is_some());
    }

    #[test]
    fn detects_sed_script_file_redirect_and_copy_back() {
        let command = concat!(
            "sed -f fix.sed src/Main.hs > /tmp/tmp.hs ",
            "&& cp /tmp/tmp.hs src/Main.hs",
        );
        assert!(detect(command).is_some());
    }

    #[test]
    fn detects_awk_read_only() {
        assert_eq!(
            detect("awk '{print $1}' a.txt").as_deref(),
            Some(concat!(
                "use of `awk`, which is rejected regardless of its purpose ",
                "(to view part of a file, use the Read tool with offset and limit instead)",
            )),
        );
    }

    #[test]
    fn detects_awk_redirect_and_copy_back() {
        // in-place編集のフラグを封じた後に実際に使われた、
        // 一時ファイルへ出力してから書き戻す手口。
        let command = concat!(
            "awk '/^test-suite/ { t = 1 } t && /^    text >=2.1 && <2.2,$/ { next } { print }' ",
            "foo.cabal > /tmp/tmp.cabal && cp /tmp/tmp.cabal foo.cabal",
        );
        assert!(detect(command).is_some());
    }

    #[test]
    fn detects_every_rejected_command_variant() {
        for name in ["sed", "gsed", "awk", "gawk", "mawk", "nawk"] {
            let command = format!("{name} 'x' a.txt");
            assert!(
                detect(&command).is_some(),
                "command {name} should be detected",
            );
        }
    }

    #[test]
    fn detects_rejected_command_with_path_prefix() {
        // パス付きでも理由文にはコマンド名本体だけが載る。
        assert!(
            detect("/usr/bin/awk '{print}' a.txt")
                .is_some_and(|detected| detected.starts_with("use of `awk`,"))
        );
    }

    #[test]
    fn detects_rejected_command_with_alias_escape() {
        assert!(detect("\\sed -n 1p a.txt").is_some());
    }

    #[test]
    fn detects_rejected_command_after_assignment() {
        assert!(detect("LC_ALL=C sed -n 1p a.txt").is_some());
    }

    #[test]
    fn detects_rejected_command_after_prefix_command() {
        for command in [
            "env LC_ALL=C awk '{print}' a.txt",
            "sudo sed -n 1p a.txt",
            "time awk '{print}' a.txt",
            "find . -name '*.hs' | xargs -0 sed -n 1p",
        ] {
            assert!(detect(command).is_some(), "{command} should be detected");
        }
    }

    #[test]
    fn detects_rejected_command_in_find_exec() {
        assert!(detect("find . -name '*.hs' -exec sed -n 1p {} \\;").is_some());
    }

    #[test]
    fn detects_rejected_command_in_command_substitution() {
        assert!(detect("x=$(awk 'NR == 1' a.txt)").is_some());
    }

    #[test]
    fn detects_rejected_command_in_subshell() {
        assert!(detect("(cd src && sed -n 1p a.txt)").is_some());
    }

    #[test]
    fn detects_rejected_command_on_new_line() {
        assert!(detect("ls\nsed -n 1p a.txt").is_some());
    }

    #[test]
    fn detects_rejected_command_after_keyword() {
        assert!(detect("for f in *.hs; do awk 'NR == 1' \"$f\"; done").is_some());
        assert!(detect("if true; then sed -n 1p a.txt; fi").is_some());
    }

    #[test]
    fn detects_rejected_command_after_stderr_merge() {
        // `2>&1`の`&`はリダイレクト演算子の一部で、
        // その後ろのパイプの先がコマンド名の位置になる。
        assert!(detect("nix fmt 2>&1 | sed 's/x//'").is_some());
    }

    #[test]
    fn skips_rejected_command_name_as_argument() {
        // コマンド名の位置に無い単語は検索語などの引数。
        assert!(detect("grep -rn sed src/").is_none());
    }

    #[test]
    fn skips_rejected_command_name_in_message() {
        assert!(detect("git commit -m \"replace sed and awk\"").is_none());
    }

    #[test]
    fn skips_rejected_command_name_in_grep_alternation() {
        // 引用符の中の`|`の直後でも、
        // 引用符が付いたままの単語はコマンド名とみなさない。
        assert!(detect("grep -n 'foo\\|sed\\|awk' a.txt").is_none());
        assert!(detect("grep -n 'sed\\|awk' a.txt").is_none());
    }

    #[test]
    fn skips_rejected_command_name_in_jq_string() {
        assert!(detect("jq 'select(test(\"awk\"))' a.json").is_none());
    }

    #[test]
    fn skips_rejected_command_name_as_redirect_target() {
        assert!(detect("echo x > awk").is_none());
    }

    #[test]
    fn detects_grep_redirect_and_copy_back() {
        // 理由文に検出したコマンド名が載ることを完全比較で固定する。
        let command = concat!(
            "grep -v '^import Himari$' src/Main.hs > /tmp/tmp.hs ",
            "&& cp /tmp/tmp.hs src/Main.hs",
        );
        assert_eq!(
            detect(command).as_deref(),
            Some("`grep` output written to files"),
        );
    }

    #[test]
    fn detects_every_filter_command_variant() {
        for name in ["grep", "egrep", "fgrep"] {
            let command = format!("{name} -v x a.txt > b.txt");
            assert!(
                detect(&command).is_some(),
                "command {name} should be detected",
            );
        }
    }

    #[test]
    fn detects_grep_with_path_prefix() {
        assert_eq!(
            detect("/usr/bin/grep -v x a.txt > b.txt").as_deref(),
            Some("`grep` output written to files"),
        );
    }

    #[test]
    fn detects_grep_append_redirect() {
        assert!(detect("grep -v x a.txt >> b.txt").is_some());
    }

    #[test]
    fn detects_grep_redirect_without_space() {
        assert!(detect("grep -v x a.txt >b.txt").is_some());
    }

    #[test]
    fn detects_grep_explicit_stdout_redirect() {
        assert!(detect("grep -v x a.txt 1> b.txt").is_some());
    }

    #[test]
    fn detects_grep_clobber_redirect() {
        assert!(detect("grep -v x a.txt >| b.txt").is_some());
    }

    #[test]
    fn detects_grep_both_output_redirect() {
        assert!(detect("grep -v x a.txt &> b.txt").is_some());
    }

    #[test]
    fn detects_grep_redirect_to_quoted_target() {
        assert!(detect("grep -v x a.txt > \"$tmp\"").is_some());
    }

    #[test]
    fn detects_grep_redirect_at_end_of_pipeline() {
        assert!(detect("cat a.txt | grep -v x > b.txt").is_some());
    }

    #[test]
    fn detects_grep_piped_through_other_command_then_redirected() {
        // 別コマンドに通しても書き込まれる内容はgrepが作ったもの。
        assert!(detect("grep -v x a.txt | sort -u > b.txt").is_some());
    }

    #[test]
    fn detects_grep_piped_into_tee() {
        assert!(detect("grep -v x a.txt | tee b.txt").is_some());
    }

    #[test]
    fn detects_grep_piped_into_tee_with_flag() {
        assert!(detect("grep -v x a.txt | tee -a b.txt").is_some());
    }

    #[test]
    fn detects_grep_piped_into_sponge() {
        assert!(detect("grep -v x a.txt | sponge a.txt").is_some());
    }

    #[test]
    fn detects_grep_redirect_after_process_substitution() {
        // プロセス置換の中の`|`や`)`ではgrepのコマンドの終わりとみなさない。
        assert!(detect("grep -v x <(sort a.txt | uniq) > b.txt").is_some());
    }

    #[test]
    fn detects_grep_redirect_after_stderr_redirect() {
        assert!(detect("grep -v x a.txt 2>/dev/null > b.txt").is_some());
    }

    #[test]
    fn detects_grep_redirect_in_compound_command() {
        assert!(detect("cd src && grep -v x a.txt > b.txt").is_some());
    }

    #[test]
    fn detects_grep_redirect_after_file_name_ending_in_digit() {
        // `file2`の`2`はファイル記述子番号ではなく引数の一部なので、
        // 直後の`>`は標準出力のリダイレクトになる。
        assert!(detect("grep -v x file2>b.txt").is_some());
    }

    #[test]
    fn skips_grep_read_only() {
        assert!(detect("grep -rn foo src/").is_none());
    }

    #[test]
    fn skips_greater_than_in_grep_pattern() {
        // 引用符の中の`>`はリダイレクトではなく検索パターン。
        assert!(detect("grep -n 'a > b' a.txt").is_none());
        assert!(detect("grep -n \"a > b\" a.txt").is_none());
    }

    #[test]
    fn skips_grep_redirect_to_dev_null() {
        assert!(detect("grep -q x a.txt > /dev/null").is_none());
    }

    #[test]
    fn skips_grep_stderr_redirect() {
        assert!(detect("grep -rn x src/ 2> err.log").is_none());
    }

    #[test]
    fn skips_grep_fd_duplication() {
        assert!(detect("grep -rn x src/ >&2").is_none());
    }

    #[test]
    fn skips_grep_stderr_merge() {
        assert!(detect("grep -rn x src/ 2>&1 | head").is_none());
    }

    #[test]
    fn skips_redirect_of_other_command_after_grep() {
        // grepのコマンドの終わり以降のリダイレクトは別コマンドのもの。
        assert!(detect("grep -q x a.txt && echo done > log.txt").is_none());
    }

    #[test]
    fn skips_grep_piped_to_other_command() {
        assert!(detect("grep -rn x src/ | sort -u").is_none());
    }

    #[test]
    fn skips_grep_piped_into_tee_to_special_file() {
        assert!(detect("grep -rn x src/ | tee /dev/stderr | wc -l").is_none());
    }

    #[test]
    fn skips_redirect_after_or_operator() {
        assert!(detect("grep -q x a.txt || echo failed > log.txt").is_none());
    }

    #[test]
    fn skips_grep_inside_command_substitution() {
        // `$(...)`の外のリダイレクトはgrepではなく`echo`のもの。
        assert!(detect("echo \"$(grep x a.txt)\" > b.txt").is_none());
    }

    #[test]
    fn skips_redirect_of_grep_used_as_argument() {
        // コマンド名の位置に無いgrepは対象外。
        assert!(detect("echo grep > b.txt").is_none());
    }

    #[test]
    fn detects_cat_heredoc_file_creation() {
        // 理由文を完全比較で固定する。
        assert_eq!(
            detect("cat > a.txt <<'EOF'\nhello\nEOF").as_deref(),
            Some("writing files with `cat` and a heredoc"),
        );
    }

    #[test]
    fn detects_cat_heredoc_with_redirect_after_marker() {
        assert!(detect("cat <<'EOF' > a.txt\nhello\nEOF").is_some());
    }

    #[test]
    fn detects_cat_heredoc_append() {
        assert!(detect("cat >> a.txt <<EOF\nhello\nEOF").is_some());
    }

    #[test]
    fn detects_cat_heredoc_with_tab_stripping() {
        assert!(detect("cat <<-EOF > a.txt\n\thello\nEOF").is_some());
    }

    #[test]
    fn detects_cat_herestring() {
        assert!(detect("cat <<< 'hello' > a.txt").is_some());
    }

    #[test]
    fn detects_cat_heredoc_piped_into_tee() {
        assert!(detect("cat <<'EOF' | tee a.txt\nhello\nEOF").is_some());
    }

    #[test]
    fn detects_cat_heredoc_in_compound_command() {
        assert!(detect("mkdir -p d && cat > d/a.txt <<'EOF'\nhello\nEOF").is_some());
    }

    #[test]
    fn detects_cat_heredoc_with_path_prefix() {
        assert!(detect("/bin/cat > a.txt <<'EOF'\nhello\nEOF").is_some());
    }

    #[test]
    fn skips_cat_heredoc_without_file_output() {
        assert!(detect("cat <<'EOF'\nhello\nEOF").is_none());
    }

    #[test]
    fn skips_cat_heredoc_in_command_substitution() {
        // コミットメッセージを渡すためのよくある書き方はファイルを作らない。
        assert!(detect("git commit -m \"$(cat <<'EOF'\nfeat: x\nEOF\n)\"").is_none());
    }

    #[test]
    fn skips_cat_heredoc_piped_to_other_command() {
        assert!(detect("cat <<'EOF' | gh pr comment 1 --body-file -\nhello\nEOF").is_none());
    }

    #[test]
    fn skips_cat_heredoc_to_dev_null() {
        assert!(detect("cat > /dev/null <<'EOF'\nhello\nEOF").is_none());
    }

    #[test]
    fn skips_cat_file_redirect_without_heredoc() {
        // ヒアドキュメントを使わないファイルの連結は対象外。
        assert!(detect("cat a.txt b.txt > c.txt").is_none());
    }

    #[test]
    fn skips_heredoc_of_piped_command_after_cat() {
        // パイプの後ろのコマンドのヒアドキュメントはcat自身の入力ではない。
        assert!(detect("cat a.txt | diff - <(cat <<'EOF'\nx\nEOF\n) > d.txt").is_none());
    }

    #[test]
    fn skips_heredoc_marker_inside_quotes() {
        assert!(detect("cat a.txt \"<<EOF\" > b.txt").is_none());
    }

    #[test]
    fn skips_flag_of_other_command() {
        assert!(detect("perl -ne 'print' a.txt && grep -i foo b.txt").is_none());
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
        // 引用符が直接接するコマンド名は検出対象にならない。
        assert!(detect("echo \"sed -i\"").is_none());
    }

    #[test]
    fn detects_command_name_after_separator_inside_quotes() {
        // クォート内でも`;`の後のコマンド名はトークン境界で裸のWordになるため、
        // 誤検知として検出される。ワンライナー抑止側へ倒す方針として許容している。
        assert!(detect("echo \"a; sed -i x\"").is_some());
    }

    #[test]
    fn detects_combined_flag_containing_i_as_false_positive() {
        // `i`を含む結合フラグは読み取り専用でも誤検知として検出される。
        // READMEの「位置づけと限界」で許容と明記した挙動を固定する。
        assert!(detect("perl -Mstrict -e 'print 1'").is_some());
    }

    #[test]
    fn detects_filename_matching_mode_letter_as_false_positive() {
        // ファイル名がモード文字そのものの場合は読み取りでも誤検知として検出される。
        // READMEの「位置づけと限界」で許容と明記した挙動を固定する。
        assert!(detect("python3 -c \"print(open('a').read())\"").is_some());
    }

    #[test]
    fn detects_write_pattern_in_other_command_as_false_positive() {
        // 書き込みパターンの探索はコマンド文字列全体に対して行うため、
        // 別コマンド側の文字列でも誤検知として検出される。
        // READMEの「位置づけと限界」で許容と明記した挙動を固定する。
        assert!(detect("rg 'File.write' src/ && ruby -e 'puts 1'").is_some());
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
