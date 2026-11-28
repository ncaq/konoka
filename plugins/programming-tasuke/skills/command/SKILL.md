---
name: command
description: Guidelines for shell commands. Avoid `cat`, `find`, `grep`, `head`, and `tail`; prohibit `rm` (use `trash` instead). Use when invoking shell commands via Bash.
user-invocable: false
---

# コマンドのガイドライン

## 非推奨

以下のコマンドは非推奨です。
代わりの手段を使ってください。

- `cat`: `Read`ツールでファイルを読みます。
- `find`: `Glob`ツールか`fd`コマンドを使います。
- `grep`: 検索には`Grep`ツールか`rg`コマンドを使います。
  コマンドの出力をパイプで絞り込むこともなるべく避けて、出力を全て読みます。
- `head`と`tail`: 一部だけを切り出さずに、`Read`ツールで全て読みます。

## 禁止

`rm`は禁止です。
代わりに`trash`コマンドを使ってください。

別プラグインの[rm-to-trash@konoka](https://github.com/ncaq/konoka/tree/master/plugins/rm-to-trash)を併用していると、
一部の`rm`は自動で`trash`に書き換えられます。
これは再試行を減らすための補助で、複雑なコマンドは書き換えられないので、
書き換えを当てにせず、最初から`trash`で書いてください。

## コミット

コミットの作成は`commit:commit`スキルに任せてください。
`commit:commit`を経由せずに`git commit`を直接実行する場合も、
コミットメッセージのスタイルは`commit:commit-style`スキルに従います。
