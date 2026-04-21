---
name: kyosei
description: Code review for PRs or local changes. Covers code quality, dependency updates, performance, test coverage, documentation accuracy, and security. Use when reviewing PRs, checking code quality, or running comprehensive code reviews.
argument-hint: "[pr-url]"
allowed-tools: Bash(node:*), Glob, Grep, Read, Task, mcp__github
---

# get-review-infoでの情報の取得

以下のコマンドでレビューに必要な情報を一括取得します。

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/bin/get-review-info.js $ARGUMENTS
```

結果はJSONで返されるので、
以下のガイドに従って解釈してください。

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

- `comments`: PR全体へのコメント一覧。以下のフィールドを持ちます。
  - `id`
  - `author`
  - `body`
  - `createdAt`
  - `updatedAt`
  - `url`
- `reviews`: レビュー一覧。以下のフィールドを持ちます。
  - `id`
  - `author`
  - `state`: `APPROVED`, `CHANGES_REQUESTED`等
  - `body`
  - `submittedAt`
  - `url`
- `reviewThreads`: インラインレビュースレッド一覧。以下に抜粋したフィールドなどを持ちます。
  - `isResolved`
  - `isOutdated`
  - `path`
  - `line`
  - `diffSide`
  - `comments`: スレッド内配列

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

投稿するレビュー情報となるJSON文字列を組み立てます。

### JSONスキーマ

- `owner`: リポジトリオーナー(`context.pr.owner`)
- `repo`: リポジトリ名(`context.pr.repo`)
- `prNumber`: PR番号(`context.pr.prNumber`)
- `headCommitId`: headコミットSHA(`changeset.headCommitId`)、スキーマ上は省略可能ですが省略しないでください。
- `event`: レビューイベント。以下のいずれか。
  - `"APPROVE"`
  - `"COMMENT"`
  - `"REQUEST_CHANGES"`
- `body`: レビュー全体のサマリー。必須であり空文字列は不可。
- `comments`: インラインコメントの配列(省略可)
  - `path`: ファイルの相対パス
  - `body`: コメント本文
  - `line`: コメントを付ける行番号(複数行の場合は終了行)
  - `startLine`: 複数行コメントの開始行(省略可能で省略したときはsingle line)
  - `side`: `"LEFT"`(削除行)または`"RIGHT"`(追加行)。デフォルト`"RIGHT"`
  - `level`: 指摘の重大度。以下のいずれか。
    - `"critical"`
    - `"high"`
    - `"medium"`
    - `"low"`
    - `"info"`

レビュー本文とインラインコメントは1回のAPI呼び出しで一括投稿されます。

### eventの決定

`event`はレビュー全体の判定を表します。
今回のレビューで新たに投稿するコメントだけでなく、
`conversation`フィールドの既存レビュー状態も考慮して総合的に判定してください。

対応や修正がされているかどうかは差分やコミットログや`conversation`フィールドの返信から判断してください。

判定基準は以下の通りです。
順番に判定してください。

#### `REQUEST_CHANGES`

以下のいずれかに該当する場合。

- 今回のコメントに`critical`レベルの指摘がある。
- 前回のレビューの`state`が`CHANGES_REQUESTED`で、その指摘に対応する修正が確認できない。

#### `APPROVE`

以下の全てを満たす場合。

- 今回のコメントが`low`または`info`のみ、もしくはコメントなし。
- 前回のレビューでの`low`または`info`以外の指摘が全て対応済みであること。

#### `COMMENT`

上記のいずれにも該当しない場合。

例として`high`や`medium`の指摘があるだけの場合。
`high`でも`REQUEST_CHANGES`ではないのは直感に反するかもしれませんが、
あまり機械によるレビューが厳しすぎないようにするための措置です。

### 投稿

以下のコマンドでレビューを一括投稿します。
引数にJSON文字列を渡してください。

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/bin/submit-review.js 'JSON_STRING'
```

指摘することがない完璧なPRの場合でも、
レビューのワークフローが正常に完了したことを伝えるため、
レビューを投稿してください。

完璧なPRの場合なのでeventは`APPROVE`で、
インラインコメントは空で構いません。

本文は空にできないため、
簡潔な総評を記述してください。

## ローカル出力の場合

各フィードバックは以下の形式で出力します:

1. ファイルパス
2. 該当箇所の差分(diffフォーマット)
3. コメント
