---
name: kyosei
description: Code review for PRs or local changes. Covers code quality, dependency updates, performance, test coverage, documentation accuracy, and security. Use when reviewing PRs, checking code quality, or running comprehensive code reviews.
argument-hint: "[pr-url]"
allowed-tools: Bash(node:*), Glob, Grep, Read, Task, mcp__github, mcp__github_inline_comment__create_inline_comment
---

# コンテキストの判定

以下のコマンドでレビューコンテキストを判定します。
結果はJSONで返されます。

!`node ${CLAUDE_PLUGIN_ROOT}/dist/src/detect-context.js $ARGUMENTS`

## JSONの解釈

`mode`フィールドでレビューモードを判別します。

### PRレビュー(GitHub投稿モード): `mode` が `"pr"` の場合

結果はGitHub PRにインラインコメントとして投稿されます。

JSONから主に以下の値を後続のコマンドで使用します:

- `owner`: リポジトリの所有者
- `repo`: リポジトリ名
- `prNumber`: PR番号

### ローカルレビュー: `mode` が `"local"` の場合

結果はターミナルに直接出力されます。

# 変更セットの取得

以下のコマンドで変更セットを取得します。
結果はJSONで返されます。

!`node ${CLAUDE_PLUGIN_ROOT}/dist/src/get-changeset.js $ARGUMENTS`

## JSONの解釈

- `diff`: 差分(diffフォーマット)
- `log`: コミットログ

# コードレビューの実行

主要領域について以下の専門のサブエージェントを並列で使用して包括的なコードレビューを実行します。

- [code-quality-reviewer](../../agents/code-quality-reviewer.md)
- [dependency-update-reviewer](../../agents/dependency-update-reviewer.md)
- [documentation-accuracy-reviewer](../../agents/documentation-accuracy-reviewer.md)
- [performance-reviewer](../../agents/performance-reviewer.md)
- [security-code-reviewer](../../agents/security-code-reviewer.md)
- [test-coverage-reviewer](../../agents/test-coverage-reviewer.md)
- [pr-conversation-collector](../../agents/pr-conversation-collector.md) (PRレビューの場合のみ実行します)

サブエージェントは一度に全て並列に起動してください。

各レビューエージェントのプロンプトには取得済みの差分を含めてください。
レビューエージェントは差分を取得するためのツールを原則として持たないため、
自分で差分を取得しないようになっています。

# 並列実行結果のマージ

複数エージェントからのレビュー結果を集約し、
重複する指摘は1つにまとめてください。

以下の3条件を全て満たす指摘は同一とみなし、
1つにまとめてください:

- 同じファイルである
- 概ね同じ行である(数行程度のずれは同一とみなす)
- 同じ論点である

異なるファイルに対する同じ論点の指摘は別々の問題として残してください。

統合時のルール:

- 重大度が異なる場合: より高い重大度を採用する
- 説明文が異なる場合: 両方の固有の情報を含めてマージする
- 対象行がずれている場合: より正確な行を採用する

# 重複コメントの除外

`pr-conversation-collector`の結果がある場合、
レビューフィードバックと照合し、
以下に該当するものは除外します:

- 既に同じ指摘が既存コメントに含まれている
- 指摘に対して「対応しない」「意図的」「仕様」等の返答がある
- 既にresolvedされたレビューコメントと同じ内容

除外後に残った特筆すべきフィードバックのみを出力します。

# フィードバックの出力

## PRレビューの場合

GitHubのPRレビューコメントとして投稿してください。
具体的な指摘には`mcp__github_inline_comment__create_inline_comment`でインラインコメントを使用してください。
全体的な所感にはトップレベルコメントを使用してください。

指摘することがない完璧なPRの場合でも、
レビューが正常に完了したことを伝えるために、
そのことをレビューコメントとして投稿してください。

## ローカルレビューの場合

各フィードバックは以下の形式で出力します:

1. ファイルパス
2. 該当箇所の差分(diffフォーマット)
3. コメント
