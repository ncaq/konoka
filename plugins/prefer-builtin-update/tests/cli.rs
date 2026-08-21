//! バイナリ全体のend-to-endテスト。
//!
//! フックとして実際に使われる、
//! 「stdinのJSON → stdoutのdeny JSONまたは無出力」という契約を、
//! ビルドされたバイナリを起動して検証する。

use std::io::Write;
use std::process::{Command, Stdio};

/// ビルド済みバイナリに標準入力を渡して実行し、出力と終了ステータスを返す。
fn run_with_stdin(input: &str) -> std::process::Output {
    let mut child = Command::new(env!("CARGO_BIN_EXE_prefer-builtin-update"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("binary should spawn");
    child
        .stdin
        .as_mut()
        .expect("stdin should be piped")
        .write_all(input.as_bytes())
        .expect("stdin write should succeed");
    child
        .wait_with_output()
        .expect("binary should run to completion")
}

#[test]
fn denies_detected_command() {
    let output = run_with_stdin(r#"{"tool_input": {"command": "sed -i s/a/b/ foo.txt"}}"#);
    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf-8");
    let value: serde_json::Value =
        serde_json::from_str(stdout.trim_end()).expect("stdout should be valid JSON");
    let specific = &value["hookSpecificOutput"];
    assert_eq!(specific["hookEventName"], "PreToolUse");
    assert_eq!(specific["permissionDecision"], "deny");
}

#[test]
fn denies_write_one_liner() {
    let output = run_with_stdin(
        r#"{"tool_input": {"command": "python3 -c \"open('a.txt', 'w').write('x')\""}}"#,
    );
    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).expect("stdout should be utf-8");
    let value: serde_json::Value =
        serde_json::from_str(stdout.trim_end()).expect("stdout should be valid JSON");
    assert_eq!(value["hookSpecificOutput"]["permissionDecision"], "deny");
}

#[test]
fn stays_silent_for_undetected_command() {
    let output = run_with_stdin(r#"{"tool_input": {"command": "ls -la"}}"#);
    assert!(output.status.success());
    assert!(output.stdout.is_empty(), "stdout should be empty");
}

#[test]
fn fails_on_invalid_json() {
    let output = run_with_stdin("not json");
    assert!(!output.status.success(), "exit status should be non-zero");
    assert!(output.stdout.is_empty(), "stdout should be empty");
    // パニックメッセージがユーザにとって原因を知る唯一の手掛かりになる。
    assert!(!output.stderr.is_empty(), "stderr should explain the error");
}
