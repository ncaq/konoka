use crate::serialize::{HookInput, decode_hook_input};
use std::io::{self, Read};

/// 標準入力からデータを読み込みデコードして返す。
/// ランタイムなエラーが発生した場合はパニックしてエラーメッセージを出力する。
pub fn read_hook_input() -> Result<HookInput, Box<dyn std::error::Error>> {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input)?;
    Ok(decode_hook_input(&input)?)
}
