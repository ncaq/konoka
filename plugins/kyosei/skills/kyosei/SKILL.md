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

トップレベルにPR自体の情報(`title`, `body`, `author`, `url`など)があり、以下の3つのサブフィールドがあります。

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

### `previousReview` フィールド(前回kyoseiレビューが復元できた場合のみ)

過去のレビュー本文末尾のメタデータフッターから復元できた最新のkyoseiレビューが含まれます。
復元できなければフィールド自体が省略されます。

- `reviewId`: GitHubのreview ID
- `event`: 前回のreview state(`APPROVED`, `CHANGES_REQUESTED`, `COMMENTED`等)
- `submittedAt`: 投稿時刻(ISO 8601 UTC)
- `metadata`: フッターから復元したメタデータ全体
  - `commit`: 特にここに前回レビュー対象コミットSHAが入ります

### `incrementalChangeset` フィールド(`previousReview`があり`headCommitId`が取れる場合のみ)

前回レビュー対象コミットから現headへの増分判定です。
`status`の値で取り扱いを分岐します。

- `status`: 以下のいずれか
  - `"tree-identical"`: 前回と現headのGit treeが同一。dependabot/renovateの典型挙動。
    - rebaseして差分がない
    - 署名し直し
    - force pushで同一に戻った
  - `"diff-empty"`: tree SHAは異なるが、`compareCommits.files`の実際の差分の行(`additions+deletions`合計)が0。masterマージのみなど。
  - `"diff-present"`: 実コード変更行が存在する。通常レビューに倒します。
  - `"lookup-failed"`: API取得失敗(SHAがGCで消えた等)。フェイルセーフで通常レビューに倒します。
- `baseSha`, `headSha`: 比較対象コミット
- 以下は参考情報。`lookup-failed`時は省略されます。
  - `baseTreeSha`
  - `headTreeSha`
  - `aheadBy`
  - `behindBy`
  - `changedFileCount`
  - `changedLineCount`

# 前回レビューによる動作の分岐

## 簡易レビューの実行

`incrementalChangeset.status`が`"tree-identical"`または`"diff-empty"`の場合は、
サブエージェントを一切起動せず、
前回レビューの判定を引き継いだ簡易レビューを組み立てて投稿してください。
Claudeの使用量を節約するための分岐です。

投稿JSONは以下のように組み立ててください。

- `body`は`status`に応じた一文を中心に組み立てます。
  - `"tree-identical"`: 例
    - 前回レビューのcommit (コミット番号) からツリー内容に変更はありません。
      rebaseによる更新のみ。
      前回判定を維持します。
  - `"diff-empty"`: 例
    - 前回レビューのcommit (コミット番号) 以降は実コード変更がないマージのみです。
      前回判定を維持します。
- `comments`は空配列。
- `event`は`previousReview.event`を引き継ぐ。
  `previousReview.event`が`APPROVED`なら`"APPROVE"`、
  `CHANGES_REQUESTED`なら`"REQUEST_CHANGES"`、
  `COMMENTED`等それ以外は`"COMMENT"`に、
  マップしてください。
- `metadata.model`は通常通り渡してください。
- `headCommitId`は`changeset.headCommitId`を使います。

フィードバックの出力セクションまでスキップしてください。

## 通常レビューの実行

`status`が`"diff-present"`/`"lookup-failed"`、
もしくは`incrementalChangeset`/`previousReview`フィールド自体が無い場合は、
通常フローを実行してください。

# コードレビューの実行

主要領域について以下の専門のサブエージェントを並列で使用して包括的なコードレビューを実行します。

- [kyosei:code-quality-reviewer](../../agents/code-quality-reviewer.md)
- [kyosei:dependency-reviewer](../../agents/dependency-reviewer.md)
- [kyosei:documentation-reviewer](../../agents/documentation-reviewer.md)
- [kyosei:performance-reviewer](../../agents/performance-reviewer.md)
- [kyosei:security-reviewer](../../agents/security-reviewer.md)
- [kyosei:test-reviewer](../../agents/test-reviewer.md)

Taskツールの`subagent_type`にはプラグイン名を含めた完全修飾名(`kyosei:<agent-name>`)を指定してください。
プラグインから提供されるサブエージェントは`<plugin-name>:<agent-name>`の形式で登録されているため、
prefixを省略すると`Agent type 'code-quality-reviewer' not found`のようなエラーになります。

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

- `level`が異なる場合: `CAUTION`, `WARNING`, `IMPORTANT`, `TIP`, `NOTE`の順でより高い重大度を採用する
- `tags`が異なる場合: 両方のタグを重複なく含める
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
- `headCommitId`: headコミットSHA(`changeset.headCommitId`)。必須かつSHA形式(7〜40桁の16進)である必要があります。
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
  - `tags`: 指摘のタグ配列。以下の文字列を必要なだけ指定してください。該当タグがない場合は空配列にしてください。
    - `"code-quality"`
    - `"dependency"`
    - `"documentation"`
    - `"performance"`
    - `"security"`
    - `"test"`
  - `level`: 指摘の重大度。以下のいずれか。
    - `"CAUTION"`
    - `"WARNING"`
    - `"IMPORTANT"`
    - `"TIP"`
    - `"NOTE"`
- `metadata`: LLM 自身しか確実には知らないメタデータ(省略可)
  - `model`: 現在使っている Claude モデルの識別子。例:`"claude-opus-4-7"`。省略時は`unknown`と表示されます。
- `internalErrors`: レビュー実行中に発生した想定外の内部エラーの配列(省略可)。
  詳細は後述「内部エラーの報告」を参照してください。
  以下の各要素を持ちます。
  - `subject`: エラーの要約(1行)。`### {subject}`としてレビュー本文中に展開されます。
  - `body`: エラーの詳細(自由記述)。Markdownとしてそのまま展開されます。スタックトレース等の生ログを載せる場合は自分でコードブロックで囲んでください。

レビュー本文とインラインコメントは1回のプログラム呼び出しで一括投稿されます。
インラインコメントの本文には`level`に対応するGitHub Alertと、
`tags`に対応する絵文字付きラベルがプログラムによって自動付与されます。

`body`の末尾にはレビューメタデータとして、
`<details>`折りたたみの形式で以下の情報が自動付与されます。

- レビュー対象コミット
- PR番号
- kyoseiバージョン
- kyosei-actionバージョン
- Claude Codeバージョン
- モデル
- 実行環境
- Run URL

プログラム側で自動付与されます。
これらの項目は`body`に書かないでください。

### 内部エラーの報告

レビューワークフロー実行中に想定外のエラーが発生した場合、`internalErrors`に`{ subject, body }`の形で詰めてください。
レビュー本文の直下に`## Internal errors`セクションが生成され、後からトリアージできるようになります。

報告すべき例(想定外で実行を乱したエラー):

- 並列起動したサブエージェントの一部が想定外に失敗し、欠けたまま続行した
- `get-review-info`の取得で部分的な失敗があり、`conversation`等が欠けた状態でレビューを組み立てた
- `submit-review`のJSON組み立てや引数渡しで試行錯誤が発生した
- レビュー対象とは別の補助コマンドが想定外のエラーで使えなかった

報告しなくてよい例(正常動作の一部):

- パッケージ情報取得時の404(登録されていないだけ)
- 任意のキャッシュミス
- 既知の権限不足で読めなかったプライベートリソース

`subject`は1行の要約。
`body`は自由記述のMarkdownです。
短い説明だけならテキストのみで十分ですが、
スタックトレースやコマンド出力をそのまま貼る場合はコードブロック(` ``` `)で囲んでください。
説明文と生ログを併記することもできます。

### eventの決定

`event`はレビュー全体の判定を表します。
今回のレビューで新たに投稿するコメントだけでなく、
`conversation`フィールドの既存レビュー状態も考慮して総合的に判定してください。

対応や修正がされているかどうかは差分やコミットログや`conversation`フィールドの返信から判断してください。

判定基準は以下の通りです。
順番に判定してください。

#### `REQUEST_CHANGES`

以下のいずれかに該当する場合。

- 今回のコメントに`CAUTION`レベルの指摘がある。
- 前回のレビューの`state`が`CHANGES_REQUESTED`で、その指摘に対応する修正が確認できない。

#### `APPROVE`

以下の全てを満たす場合。

- 今回のコメントが`TIP`または`NOTE`のみ、もしくはコメントなし。
- 前回のレビューでの`TIP`または`NOTE`以外の指摘が全て対応済みであること。

#### `COMMENT`

上記のいずれにも該当しない場合。

例として`WARNING`や`IMPORTANT`の指摘があるだけの場合。
`WARNING`でも`REQUEST_CHANGES`ではないのは直感に反するかもしれませんが、
あまり機械によるレビューが厳しすぎないようにするための措置です。

### 投稿

#### 注意事項

submit-reviewコマンドはGitHub APIを直接呼び出し、
PRに対してレビューを即座に投稿する破壊的アクションです。

投稿された瞬間にPR著者やwatcherに通知が飛びます。

投稿後に「投稿しなかったことにする」操作はできません。
権限がある場合に限り編集や削除は可能ですが、通知や監査ログには痕跡が残ります。

`"test"`, `"テスト"`, `"動作確認"`のような中身のない文字列をbodyにして投稿してはいけません。
レビューを実投稿する前提で組み立てたJSONのみを渡してください。

コマンドが正しく動くか不安だったり、
JSONがスキーマを通るか確認したいだけの場合は、
後述の`--dry-run`を使ってください。
実投稿で試し打ちするのは禁止です。

#### 実際のコマンド

以下のコマンドでレビューを一括投稿します。
引数にJSON文字列を渡してください。

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/bin/submit-review.js 'JSON_STRING'
```

#### 指摘することがない場合

指摘することがない完璧なPRの場合でも、
レビューのワークフローが正常に完了したことを伝えるため、
レビューを投稿してください。

完璧なPRの場合なのでeventは`APPROVE`で、
インラインコメントは空で構いません。

本文は空にできないため、
簡潔な総評を記述してください。

### 動作確認(`--dry-run`)

組み立てたJSONがスキーマやメタデータ生成を通るかだけ検証したい場合は、
`--dry-run`フラグを付けて実行します。

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/bin/submit-review.js --dry-run 'JSON_STRING'
```

GitHub APIへの投稿は行われず、
`{"dryRun": true, "params": {...}}`の形式で、
`createReview`に渡される予定のパラメータがJSON出力されます。

通常のレビューワークフローでは使いません。

コマンドの挙動を確かめたい場合や、
JSONの組み立てを検証したい場合に限ってこちらを使ってください。

本番のレビュー投稿前に試し打ちすることはあまり想定していません。
スキーマが不正な場合は本番レビューモードでもバリデーションでエラーになるので、
本当に投稿する予定のデータなら、
エラーログを確認すれば十分なはずだからです。

## ローカル出力の場合

各フィードバックは以下の形式で出力します:

1. ファイルパス
2. 該当箇所の差分(diffフォーマット)
3. コメント
