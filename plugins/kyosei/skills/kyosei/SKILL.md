---
name: kyosei
description: Code review for PRs or local changes. Covers code quality, dependency updates, performance, test coverage, documentation accuracy, and security. Use when reviewing PRs, checking code quality, or running comprehensive code reviews.
argument-hint: "[pr-url]"
allowed-tools: Bash(node:*), Glob, Grep, Read, Task, mcp__github
---

# get-review-infoでの情報の取得

以下のコマンドでレビューに必要な情報を一括取得します。
結果はJSONで返されるので、そのまま解釈してください。

```
node ${CLAUDE_PLUGIN_ROOT}/dist/bin/get-review-info.js $ARGUMENTS
```

## JSONの解釈

### `context` フィールド

`context.output`フィールドで出力先を判別します。

#### `"github"`

GitHub出力。
結果はGitHub PRにインラインコメントとして投稿されます。
`host`と`pr`(`owner`, `repo`, `prNumber`)が含まれます。

#### `"local"`

ローカル出力。
結果はターミナルに直接出力されます。
ブランチに紐付くPRが特定できた場合は`pr`が含まれます。

### `changeset` フィールド

- `diff`: 差分(diffフォーマット)
- `log`: コミットログ
- `headCommitId`: PRのheadコミットSHA(GitHub出力時のみ)

### `conversation` フィールド(PRが特定できた場合のみ)

PRの既存コメント・レビュー情報です。
GitHub出力モードでは常に含まれます。
ローカル出力モードでもブランチに紐付くPRがあれば含まれます。
PRが特定できない場合はフィールド自体が省略されます。

トップレベルにPR自体の情報(`title`, `body`, `author`, `url`)があり、以下の3つのサブフィールドがあります。

- `comments`: PR全体へのコメント一覧。`id`, `author`, `body`, `createdAt`, `updatedAt`, `url`を持ちます。
- `reviews`: レビュー一覧。`id`, `author`, `state`(APPROVED, CHANGES_REQUESTED等), `body`, `submittedAt`, `url`を持ちます。
- `reviewThreads`: インラインレビュースレッド一覧。`isResolved`, `isOutdated`, `path`, `line`, `diffSide`等のメタデータと、スレッド内`comments`配列を持ちます。

# コードレビューの実行

主要領域について以下の専門のサブエージェントを並列で使用して包括的なコードレビューを実行します。

- [code-quality-reviewer](../../agents/code-quality-reviewer.md)
- [dependency-update-reviewer](../../agents/dependency-update-reviewer.md)
- [documentation-accuracy-reviewer](../../agents/documentation-accuracy-reviewer.md)
- [performance-reviewer](../../agents/performance-reviewer.md)
- [security-code-reviewer](../../agents/security-code-reviewer.md)
- [test-coverage-reviewer](../../agents/test-coverage-reviewer.md)

サブエージェントは一度に全て並列に起動してください。

各レビューエージェントのプロンプトにはget-review-infoで取得済みの情報を含めてください。
レビューエージェントは差分を取得するためのツールを原則として持たないため、
自分で差分を取得しないようになっています。

# 並列実行結果のマージ

各サブエージェントはJSON配列で結果を返します。
全エージェントの配列を結合した上で、
重複する指摘は1つにまとめてください。

以下の3条件を全て満たす指摘は同一とみなし、
1つにまとめてください:

- 同じファイルである
- 概ね同じ行である(数行程度のずれは同一とみなす)
- 同じ論点である

異なるファイルに対する同じ論点の指摘は別々の問題として残してください。

統合時のルール:

- `level`が異なる場合: より高い重大度を採用する
- `body`が異なる場合: 両方の固有の情報を含めてマージする
- `line`がずれている場合: より正確な行を採用する

# 重複コメントの除外

`conversation`フィールドが存在する場合、
レビューフィードバックと照合し、
以下に該当するものは除外します:

- 既に同じ指摘が既存コメントに含まれている
- 指摘に対して「対応しない」「意図的」「仕様」等の返答がある
- 既にresolvedされたレビューコメントと同じ内容

除外後に残った特筆すべきフィードバックのみを出力します。

# フィードバックの出力

## GitHub出力の場合

以下のコマンドでレビューを一括投稿します。
stdinにJSON形式のレビューデータを渡してください。

```
node ${CLAUDE_PLUGIN_ROOT}/dist/bin/submit-review.js <<'KYOSEI_SUBMIT_REVIEW_JSON_INPUT_HEREDOC_DELIMITER'
{JSON}
KYOSEI_SUBMIT_REVIEW_JSON_INPUT_HEREDOC_DELIMITER
```

### JSONスキーマ

- `owner`: リポジトリオーナー(`context.pr.owner`)
- `repo`: リポジトリ名(`context.pr.repo`)
- `prNumber`: PR番号(`context.pr.prNumber`)
- `headCommitId`: headコミットSHA(`changeset.headCommitId`)
- `body`: レビュー全体のサマリー
- `comments`: インラインコメントの配列(省略可)
  - `path`: ファイルの相対パス
  - `body`: コメント本文
  - `line`: コメントを付ける行番号(複数行の場合は終了行)
  - `startLine`: 複数行コメントの開始行(省略でsingle line)
  - `side`: `"LEFT"`(削除行)または`"RIGHT"`(追加行)。デフォルト`"RIGHT"`
  - `level`: 指摘の重大度。`"critical"`, `"high"`, `"medium"`, `"low"`, `"info"`のいずれか

レビュー本文とインラインコメントは1回のAPI呼び出しで一括投稿されます。
レビューイベント(APPROVE/COMMENT/REQUEST_CHANGES)はコメントの`level`から自動決定されます。

指摘することがない完璧なPRの場合でも、
レビューが正常に完了したことを伝えるために、
コメントなしでレビューを投稿してください(APPROVEになります)。

## ローカル出力の場合

各フィードバックは以下の形式で出力します:

1. ファイルパス
2. 該当箇所の差分(diffフォーマット)
3. コメント
