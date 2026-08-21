//! `PreToolUse`フックでBashツールに渡されたファイル書き換えコマンドを検出し、
//! 組み込みの`Edit`ツールへ誘導するために拒否します。
//!
//! 検出対象外のケースは無言で終了し、
//! Claude Code側の通常の承認フローへ委ねます。
//!
//! このモジュールはI/Oモジュールを呼び出しdetectへ橋渡しするエントリポイント。

mod detect;
mod input;
mod output;
mod serialize;

use crate::detect::detect;
use crate::input::read_hook_input;
use crate::output::output_deny;

/// 標準入力からデータを読み込んで、
/// ファイル書き換えを検出した場合は標準出力に拒否のJSONを出力します。
/// 検出しなかった場合など何もする必要がない場合は何も出力せずに終了します。
/// 異常なことが発生した場合はパニックしてエラーメッセージを出力します。
fn main() {
    // 入力を読み込んでデコードする。
    let hook_input = read_hook_input().expect("failed to read and decode input");
    // 検出ロジックを動かす。
    let Some(detected) = detect(&hook_input.tool_input.command) else {
        // 検出対象外のケースは無言で終了する。
        return;
    };
    // 拒否の判断を出力する。
    output_deny(&detected).expect("failed to output deny decision");
}
