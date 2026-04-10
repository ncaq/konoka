---
name: kyosei
description: Code review for PRs or local changes. Covers code quality, performance, test coverage, documentation accuracy, and security. Use when reviewing PRs, checking code quality, or running comprehensive code reviews.
argument-hint: "[pr-url]"
allowed-tools: Bash(gh pr checks:*), Bash(gh pr diff:*), Bash(gh pr list:*), Bash(gh pr view:*), Bash(gh repo view:*), Bash(git diff:*), Bash(git log:*), Bash(git rev-parse:*), Glob, Grep, Read, Task, mcp__github, mcp__github_inline_comment__create_inline_comment
---

# コンテキストの判定

以下の順序でレビュー対象のコンテキストを判定します。

## PRレビュー(GitHub投稿モード)

`$ARGUMENTS`がGitHub PRのURLの場合、PRレビューとして実行します。
結果はGitHub PRにインラインコメントとして投稿されます。

例: `/kyosei https://github.com/ncaq/konoka/pull/42`

URLから所有者`<owner>`、リポジトリ名`<repo>`、PR番号`<pr-number>`を抽出してください。
URLが`https://<host>/<owner>/<repo>/pull/<pr-number>`を含んでいればPR URLとみなします。
ホストは`github.com`に限らずGitHub Enterpriseのドメインでも構いません。
末尾スラッシュ、サブパス(`/files`、`/commits`等)、クエリパラメータが付いていても問題ありません。
抽出した値は後続のコマンドで使用します。

CI経由でもローカルからでも、PR URLを渡せばPRレビューモードで実行されます。

## ローカルレビュー

`$ARGUMENTS`がない場合、ローカルレビューとして実行します。
結果はターミナルに直接出力されます。

# ベースブランチの特定

1. `gh pr view --json baseRefName --jq .baseRefName`でPRのベースブランチを取得
2. PRが存在しない場合(コマンドがエラーになった場合)は、
   `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`でデフォルトブランチを使用

# 差分の取得

コンテキストに応じて差分を取得します。

- PRレビュー(GitHub投稿モード): `gh pr diff <pr-number> --repo <owner>/<repo>`(URLから抽出した値を使用)
- ローカルレビュー: `git diff <base>...HEAD` と `git log <base>...HEAD`

# コードレビューの実行

以下の主要領域について専門のサブエージェントを並列で使用して包括的なコードレビューを実行します。

- code-quality-reviewer
- documentation-accuracy-reviewer
- performance-reviewer
- security-code-reviewer
- test-coverage-reviewer

LLMは1回のレビューでは指摘漏れが発生しやすく、
後から追加で指摘が出てくることがあります。
見逃しを緩和するため、
上記のレビューエージェントはそれぞれ2回ずつ並列で起動してください。
同じエージェントでも独立した実行になるため、
得られる指摘は毎回少しずつ異なります。

PRレビューの場合は`pr-conversation-collector`も並列で起動します。
こちらは既存会話の収集が目的でLLMの出力揺らぎによる差分を狙うものではないため、1回のみの起動で十分です。

各レビューエージェントには特筆すべきフィードバックのみを提供するよう指示します。

# 並列実行結果のマージ

2回ずつ実行したレビュー結果を和集合(OR)で統合してください。
片方の実行でしか報告されなかった指摘も採用します。
見逃し緩和が目的なので、どちらか一方でも報告された指摘は全て残します。

以下の3条件を全て満たす指摘は同一とみなし、1つにまとめてください:

- 同じファイルである
- 概ね同じ行である(数行程度のずれは同一とみなす)
- 同じ論点である

異なるファイルに対する同じ論点の指摘は別々の問題として残してください。

統合時のルール:

- 重大度が異なる場合: より高い重大度を採用する
- 説明文が異なる場合: 両方の固有の情報を含めてマージする
- 対象行がずれている場合: より正確な行を採用する

# 重複コメントの除外

`pr-conversation-collector`の結果がある場合、レビューフィードバックと照合し、以下に該当するものは除外します:

- 既に同じ指摘が既存コメントに含まれている
- 指摘に対して「対応しない」「意図的」「仕様」等の返答がある
- 既にresolvedされたレビューコメントと同じ内容

除外後、残った特筆すべきフィードバックのみを出力します。

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
