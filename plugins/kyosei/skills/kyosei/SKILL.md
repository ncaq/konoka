---
name: kyosei
description: Code review for PRs or local changes. Covers code quality, performance, test coverage, documentation accuracy, and security. Use when reviewing PRs, checking code quality, or running comprehensive code reviews.
argument-hint: "[REPO:owner/repo PR_NUMBER:N]"
allowed-tools: Bash(gh pr checks:*), Bash(gh pr diff:*), Bash(gh pr list:*), Bash(gh pr view:*), Bash(gh repo view:*), Bash(git diff:*), Bash(git log:*), Bash(git rev-parse:*), Glob, Grep, Read, Task, mcp__github, mcp__github_inline_comment__create_inline_comment
---

# コンテキストの判定

以下の順序でレビュー対象のコンテキストを判定します。

## PRレビュー(GitHub投稿モード)

`$ARGUMENTS`が以下の形式の場合、PRレビューとして実行します。
結果はGitHub PRにインラインコメントとして投稿されます。

```
REPO:owner/repo PR_NUMBER:N
```

例: `REPO:ncaq/konoka PR_NUMBER:42`

CI経由でもローカルからでも、この引数を渡せばPRレビューモードで実行されます。

## ローカルレビュー

`$ARGUMENTS`がない場合、ローカルレビューとして実行します。
結果はターミナルに直接出力されます。

# ベースブランチの特定

1. `gh pr view --json baseRefName --jq .baseRefName`でPRのベースブランチを取得
2. PRが存在しない場合(コマンドがエラーになった場合)は、
   `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`でデフォルトブランチを使用

# 差分の取得

コンテキストに応じて差分を取得します。

- PRレビュー(GitHub投稿モード): `gh pr diff PR_NUMBER --repo REPO`
- ローカルレビュー: `git diff <base>...HEAD` と `git log <base>...HEAD`

# コードレビューの実行

以下の主要領域について専門のサブエージェントを並列で使用して包括的なコードレビューを実行します。

- code-quality-reviewer
- documentation-accuracy-reviewer
- performance-reviewer
- pr-conversation-collector(PRレビューの場合のみ)
- security-code-reviewer
- test-coverage-reviewer

各レビューエージェントには特筆すべきフィードバックのみを提供するよう指示します。

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
