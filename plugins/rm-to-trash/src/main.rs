//! `PreToolUse`フックでBashツールに渡された単純な`rm`を`trash`へ書き換えます。
//!
//! 書き換え対象外のケースは無言で終了し、
//! Claude Code側の通常の承認フローへ委ねます。
//! このモジュールは入出力を行いロジックに渡します。

mod rewrite;
mod serialize;

use crate::rewrite::*;
use crate::serialize::*;

use std::io::{self, Read};

/// 標準入力からデータを読み込んで、
/// 書き換えが発生した場合は標準出力にJSONを出力します。
/// 書き換えが発生しなかった場合は何も出力せずに終了します。
/// 予測していないことが発生した場合はパニックしてエラーメッセージを出力します。
fn main() {
    // 標準入力からJSONを読み込む。
    let mut input = String::new();
    if let Err(e) = io::stdin().read_to_string(&mut input) {
        panic!("Error: failed to read input: {e}");
    }
    // デコードする。
    let hook_input = match decode_hook_input(&input) {
        Err(e) => {
            panic!("Error: failed to decode input JSON: {e}");
        }
        Ok(payload) => payload,
    };
    // 入力が空の場合は何もせずに終了する。
    if hook_input.tool_input.command.is_empty() {
        return;
    }

    // 書き換えロジックを動かす。
    let original = hook_input.tool_input.command;
    let Some(rewritten) = rewrite(&original) else {
        // 書き換え対象外のケースは無言で終了する。
        return;
    };

    // 書き換えた内容を出力する。
    let rewritten_tool_input = ToolInput {
        command: rewritten.clone(),
        ..hook_input.tool_input
    };
    let output = mk_hook_output(rewritten_tool_input, &original, &rewritten);
    match serde_json::to_string(&output) {
        Err(e) => {
            panic!("Error: failed to serialize hook output: {e}");
        }
        Ok(json) => println!("{json}"),
    }
}
