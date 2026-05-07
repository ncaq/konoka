//! `PreToolUse`フックでBashツールに渡された単純な`rm`を`trash`へ書き換えます。
//!
//! 書き換え対象外のケースは無言で終了し、
//! Claude Code側の通常の承認フローへ委ねます。
//! このモジュールは入出力を行いロジックに渡します。

mod input;
mod output;
mod rewrite;
mod serialize;

use crate::input::read_hook_input;
use crate::output::output_tool_input;
use crate::rewrite::rewrite;
use crate::serialize::ToolInput;

/// 標準入力からデータを読み込んで、
/// 書き換えが発生した場合は標準出力にJSONを出力します。
/// 書き換えが発生しなかった場合など何もする必要がない場合は何も出力せずに終了します。
/// 異常なことが発生した場合はパニックしてエラーメッセージを出力します。
fn main() {
    // 入力を読み込んでデコードする。
    let hook_input = read_hook_input().expect("failed to read and decode input");
    // 入力が空の場合は何もせずに終了する。
    if hook_input.tool_input.command.is_empty() {
        return;
    }
    // ヒントのために元の文字列をとっておく。
    let original = hook_input.tool_input.command;
    // 書き換えロジックを動かす。
    let Some(rewritten) = rewrite(&original) else {
        // 書き換え対象外のケースは無言で終了する。
        return;
    };
    // 書き換えた内容を反映した出力のための構造体を作る。
    let rewritten_tool_input = ToolInput {
        command: rewritten,
        ..hook_input.tool_input
    };
    // 書き換えた内容を出力する。
    output_tool_input(rewritten_tool_input, &original).expect("failed to output rewritten command");
}
