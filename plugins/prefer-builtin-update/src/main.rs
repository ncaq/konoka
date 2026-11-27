//! `PreToolUse`フックでBashツールに渡されたファイル書き換えコマンドを検出し、
//! 組み込みの`Edit`ツールへ誘導するために拒否します。
//! インラインスクリプトの即座実行も検出し、
//! `Write`ツールによるスクリプトファイルの書き出しへ誘導するために拒否します。
//!
//! 検出対象外のケースは無言で終了し、
//! Claude Code側の通常の承認フローへ委ねます。
//!
//! このモジュールはI/Oモジュールを呼び出しdetectへ橋渡しするエントリポイント。

mod detect;
mod inline_script;
mod input;
mod output;
mod serialize;

use crate::detect::detect;
use crate::inline_script::detect_inline_script;
use crate::input::read_hook_input;
use crate::output::output_deny;
use crate::serialize::Guidance;

/// 標準入力からデータを読み込んで、
/// ファイル書き換えかインラインスクリプトの即座実行を検出した場合は、
/// 標準出力に拒否のJSONを出力します。
/// 検出しなかった場合など何もする必要がない場合は何も出力せずに終了します。
/// 異常なことが発生した場合はパニックしてエラーメッセージを出力します。
fn main() {
    // 入力を読み込んでデコードする。
    let hook_input = read_hook_input().expect("failed to read and decode input");
    let command = &hook_input.tool_input.command;
    // 検出ロジックを動かす。
    // ファイルを書き換えるインラインスクリプトは両方に当たるので、
    // `Edit`ツールへ誘導するファイル書き換えの検出を優先する。
    let detection = detect(command)
        .map(|detected| (detected, Guidance::Update))
        .or_else(|| {
            detect_inline_script(command).map(|detected| (detected, Guidance::InlineScript))
        });
    let Some((detected, guidance)) = detection else {
        // 検出対象外のケースは無言で終了する。
        return;
    };
    // 拒否の判断を出力する。
    output_deny(&detected, guidance).expect("failed to output deny decision");
}
