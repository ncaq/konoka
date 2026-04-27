---
name: command
description: Guidelines for shell commands. Avoid `cat`, `find`, `grep`, `head`, and `tail`; prohibit `rm` (use `trash` instead). Use when invoking shell commands via Bash.
user-invocable: false
---

# コマンドのガイドライン

## 非推奨

- `cat`: 代わりに`Read`ツールでファイルを読み込んでください。
- `find`: 代わりに`Glob`ツールか`fd`コマンドを使ってください。
- `grep`: 検索には`Grep`ツールか`rg`コマンドを使ってください。パイプのフィルタリングはなるべくせずに出力内容を全部読んでください。

- `head`: `Read`ツールで全部読んでください。
- `tail`: `Read`ツールで全部読んでください。

## 禁止

- `rm`: 代わりに`trash`コマンドを使ってください。

## コミット

`git commit`の作成は`commit:commit`スキルに任せてください。
このスキルではコミットメッセージの生成や実行を扱いません。

`commit:commit`を経由しない直接の`git commit`コマンドであっても、
コミットメッセージのスタイルは`commit:commit-style`スキルに従ってください。
