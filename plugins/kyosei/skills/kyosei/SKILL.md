---
name: kyosei
description: Code review for PRs or local changes. Covers code quality, dependency updates, performance, test coverage, documentation accuracy, and security. Use when reviewing PRs, checking code quality, or running comprehensive code reviews.
argument-hint: "[pr-url]"
allowed-tools: >-
  Bash(node:*),
  Glob,
  Grep,
  Read,
  Skill(kyosei:code-quality-reviewer),
  Skill(kyosei:dependency-reviewer),
  Skill(kyosei:documentation-reviewer),
  Skill(kyosei:performance-reviewer),
  Skill(kyosei:security-reviewer),
  Skill(kyosei:test-reviewer),
  mcp__github
effort: low
---

# get-review-infoでの情報の取得

以下のコマンドでレビューに必要な情報を取得して、
用途別のファイルに書き出します。

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/bin/get-review-info.js $ARGUMENTS
```

標準出力にはレビュー情報自体ではなく、
書き出したファイルの絶対パスを持つJSONが1行だけ返されます。
出力を`tail`やパイプなどで加工せず、
JSON全体をそのまま受け取ってください。

以下は出力例です。

```json
{
  "context": "/run/user/1000/coding-agent-work/kyosei/review-info-example/context.json",
  "patch": "/run/user/1000/coding-agent-work/kyosei/review-info-example/changeset.patch",
  "commits": "/run/user/1000/coding-agent-work/kyosei/review-info-example/commits.log",
  "changesetMetadata": "/run/user/1000/coding-agent-work/kyosei/review-info-example/changeset-metadata.json",
  "conversation": "/run/user/1000/coding-agent-work/kyosei/review-info-example/conversation.json",
  "previousReview": "/run/user/1000/coding-agent-work/kyosei/review-info-example/previous-review.json",
  "incrementalChangeset": "/run/user/1000/coding-agent-work/kyosei/review-info-example/incremental-changeset.json"
}
```

返されたパスのファイルを`Read`ツールで直接読んでください。
レビュー情報を1つのJSONへ結合したり、
一部を取り出すためにシェルコマンドで加工したりしないでください。

## パスJSONの解釈

### `context`

`context.json`へのパスです。

`context.output`フィールドで出力先を判別します。

#### `"github"`

GitHub出力。
結果はGitHub PRにインラインコメントとして投稿されます。
`host`と`pr`(`owner`, `repo`, `prNumber`)が含まれます。

#### `"local"`

ローカル出力。
結果はターミナルに直接出力されます。
ブランチに紐付くPRが特定できた場合は`pr`が含まれます。

### `patch`

レビュー対象の差分をdiffフォーマットで保存した`changeset.patch`へのパスです。

### `commits`

コミットログを保存した`commits.log`へのパスです。

### `changesetMetadata` (`headCommitId`が存在する場合のみ)

`headCommitId`を保存した`changeset-metadata.json`へのパスです。
主にGitHub出力時に含まれます。

### `conversation` (PRが特定できた場合のみ)

PRの既存コメント・レビュー情報を保存した`conversation.json`へのパスです。
GitHub出力モードでは常に含まれます。
ローカル出力モードでもブランチに紐付くPRがあれば含まれます。
PRが特定できない場合はパスJSONから省略されます。

トップレベルにPR自体の情報(`title`, `body`, `author`, `url`など)があり、
以下の3つのサブフィールドがあります。

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

### `previousReview` (前回kyoseiレビューが復元できた場合のみ)

過去のレビュー本文末尾のメタデータフッターから復元できた、
最新のkyoseiレビューを保存した`previous-review.json`へのパスです。
復元できなければパスJSONから省略されます。

- `reviewId`: GitHubのreview ID
- `event`: 前回のreview state(`APPROVED`, `CHANGES_REQUESTED`, `COMMENTED`等)
- `submittedAt`: 投稿時刻(ISO 8601 UTC)
- `metadata`: フッターから復元したメタデータ全体
  - `commit`: 特にここに前回レビュー対象コミットSHAが入ります

### `incrementalChangeset` (`previousReview`があり`headCommitId`が取れる場合のみ)

前回レビュー対象コミットから現headへの増分判定を保存した、
`incremental-changeset.json`へのパスです。
`status`の値で取り扱いを分岐します。

- `status`: 以下のいずれか
  - `"tree-identical"`: 前回と現headのGit treeが同一。dependabot/renovateの典型挙動。
    - rebaseして差分がない
    - 署名し直し
    - force pushで同一に戻った
  - `"diff-empty"`:
    tree SHAは異なるが`compareCommits.files`の実際の差分の行である`additions+deletions`の合計が0。
    masterマージのみなど。
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

`incremental-changeset.json`の`status`が`"tree-identical"`または`"diff-empty"`の場合は、
レビュースキルを一切起動せず、
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
- `headCommitId`は`changeset-metadata.json`の`headCommitId`を使います。

フィードバックの出力セクションまでスキップしてください。

## 通常レビューの実行

`status`が`"diff-present"`/`"lookup-failed"`、
もしくは`incrementalChangeset`/`previousReview`のパス自体が無い場合は、
通常フローを実行してください。

# コードレビューの実行

主要領域について以下の専門のレビュースキルを並列で使用して包括的なコードレビューを実行します。

- [kyosei:code-quality-reviewer](../code-quality-reviewer/SKILL.md)
- [kyosei:dependency-reviewer](../dependency-reviewer/SKILL.md)
- [kyosei:documentation-reviewer](../documentation-reviewer/SKILL.md)
- [kyosei:performance-reviewer](../performance-reviewer/SKILL.md)
- [kyosei:security-reviewer](../security-reviewer/SKILL.md)
- [kyosei:test-reviewer](../test-reviewer/SKILL.md)

Skillツールの`skill`には、
プラグイン名を含めた完全修飾名(`kyosei:<skill-name>`)を指定してください。
プラグインから提供されるスキルは`<plugin-name>:<skill-name>`の形式で登録されているため、
prefixを省略すると見つからない旨のエラーになります。

各レビュースキルは`context: fork`と`background: true`で定義されているため、
それぞれ独立したサブエージェントとしてバックグラウンドで実行されます。
レビュースキルは一度に全て並列に起動してください。
バックグラウンド実行される環境では呼び出しは即座に返り、
結果は完了通知として後から届きます。
非対話モードなど呼び出しの場で結果が返る環境では、
そのまま残りのレビュースキルの起動に進んでください。
全てのレビュースキルの結果が揃ってから結果のマージに進んでください。

各レビュースキルの引数(`args`)にはget-review-infoが返したパスJSON全体を、
加工せずに含めてください。
レビュースキルは差分を取得するためのツールを原則として持たないため、
`patch`などのパスを`Read`してレビューします。

# 並列実行結果のマージ

各レビュースキルはJSON配列で結果を返します。
全スキルの配列を結合した上で、
重複する指摘は1つにまとめてください。

以下の3条件を全て満たす指摘は同一とみなし、
1つにまとめてください:

- 同じファイルである
- 概ね同じ行である(数行程度のずれは同一とみなす)
- 同じ論点である

異なるファイルに対する同じ論点の指摘は別々の問題として残してください。

統合時のルール:

- `level`が異なる場合: 以下の順でより高い重大度を採用する
  - `CAUTION` > `WARNING` > `IMPORTANT` > `TIP` > `NOTE`
- `tags`が異なる場合: 両方のタグを重複なく含める
- `body`が異なる場合: 両方の固有の情報を含めてマージする
- `line`がずれている場合: より正確な行を採用する

# 重複コメントの除外

`conversation`のパスが存在する場合、
レビューフィードバックと照合し、
以下に該当するものは除外します:

- 既に同じ指摘が既存コメントに含まれている
- 指摘に対して「対応しない」「意図的」「仕様」等の返答がある
- 既にresolvedされたレビューコメントと同じ内容

除外後に残った特筆すべきフィードバックのみを出力します。

# cross-reference機能の注意

サマリーでもインラインコメントでも、
あらゆる場所のテキストに言えることですが、
issueやPRを参照する時には常にUsernameとRepositoryを含めてください。

外部のリポジトリのissueやPRに言及したつもりで、
内部のリポジトリへの誤った参照をしてしまうのを防ぐためです。

以下のような記法は避けてください。

```markdown
see #26
```

代わりに以下のような記法を使ってください。

```markdown
see jlord/sheetsee.js#26
```

# フィードバックの出力

## GitHub出力の場合

投稿するレビュー情報となるJSON文字列を組み立てます。

### JSONスキーマ

- `owner`: リポジトリオーナー(`context.pr.owner`)
- `repo`: リポジトリ名(`context.pr.repo`)
- `prNumber`: PR番号(`context.pr.prNumber`)
- `headCommitId`: headコミットSHA(`changeset-metadata.json`の`headCommitId`)。
  必須かつSHA形式(7〜40桁の16進)である必要があります。
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
  - `tags`: 指摘のタグ配列。
    以下の文字列を必要なだけ指定してください。
    該当タグがない場合は空配列にしてください。
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
  - `model`: 現在使っている Claude モデルの識別子。
    例: `"claude-opus-4-7"`。
    省略時は`unknown`と表示されます。
- `internalErrors`: レビュー実行中に発生した想定外の内部エラーの配列(省略可)。
  詳細は後述「内部エラーの報告」を参照してください。
  以下の各要素を持ちます。
  - `subject`: エラーの要約(1行)。`### {subject}`としてレビュー本文中に展開されます。
  - `body`:
    エラーの詳細(自由記述)。
    Markdownとしてそのまま展開されます。
    スタックトレース等の生ログを載せる場合は自分でコードブロックで囲んでください。

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

レビューワークフロー実行中に想定外のエラーが発生した場合、
`internalErrors`に`{ subject, body }`の形で詰めてください。
レビュー本文の直下に`## Internal errors`セクションが生成され、
後からトリアージできるようになります。

報告すべき例(想定外で実行を乱したエラー):

- 並列起動したレビュースキルの一部が想定外に失敗し、欠けたまま続行した
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
`conversation.json`の既存レビュー状態も考慮して総合的に判定してください。

対応や修正がされているかどうかは、
`changeset.patch`, `commits.log`, `conversation.json`の返信から判断してください。

判定基準は以下の通りです。
順番に判定してください。

#### `REQUEST_CHANGES`

以下のいずれかに該当する場合。

- 今回のコメントに`CAUTION`レベルの指摘がある。
- 前回のレビューの`state`が`CHANGES_REQUESTED`で、
  その原因になった`CAUTION`相当の指摘に対応する修正が確認できない。

#### `APPROVE`

以下の全てを満たす場合。

- 今回のコメントに`CAUTION`レベルの指摘がない。
  `WARNING`, `IMPORTANT`, `TIP`, `NOTE`の指摘しかない場合や、
  コメントなしの場合が該当します。
- 前回のレビューでの`CAUTION`相当の指摘が全て対応済みであること。

`WARNING`や`IMPORTANT`の指摘が残っていても`APPROVE`するのは直感に反するかもしれませんが、
あまり機械によるレビューが厳しすぎないようにするための措置です。

`REQUEST_CHANGES`や`COMMENT`はGitHubの承認要求を満たさないため、
残り続けると人間がマージできなくなります。
本当にマージを止めるべき`CAUTION`だけを承認の妨げにしてください。

指摘を`APPROVE`で投稿しても、
インラインコメントは通常通り残るので、
指摘自体が失われることはありません。

#### `COMMENT`

上記のいずれにも該当しない場合。

例として今回のコメントに`CAUTION`レベルの指摘はないものの、
前回の`CAUTION`相当の指摘が対応済みかどうか判断できない場合などです。

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
