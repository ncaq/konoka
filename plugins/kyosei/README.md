# kyosei

Code review for PRs or local changes.
Covers code quality, dependency updates, performance, test coverage, documentation accuracy, and security.

専門サブエージェントを並列起動して包括的なコードレビューを行うClaude Codeプラグインです。

## モチベーション

### 公式のワークフローが再レビューを行わなくなった

Claude Codeの`install-github-app`でインストールされるClaude Code Reviewのワークフローは、
同じPRに対してpush後の再レビューを行いません。
初回のレビュー以降、コードを修正してpushしても新たなレビューが実行されないため、
指摘事項への対応が正しく行われたかを自動で確認できないという致命的な問題があります。

### claude-code-actionが採用していた方式ベースで動くようにしました

kyoseiは、
[claude-code-action](https://github.com/anthropics/claude-code-action)
リポジトリが採用しているレビューパターンをベースにこの問題を解決しています。

内部でレビューエージェントを複数並列起動するスキルを作って、
それを起動する形をとっています。

### claude-code-actionからの改良

ただしclaude-code-actionが使っているパターンでは不十分に感じる点があったため、
kyoseiではさらに改善を加えています。

#### 同じ指摘の防止

claude-code-actionのものをそのまま移植すると、

- 同じPRにpushを繰り返すと、既に指摘済みの同じコメントが何度も投稿される
- 「意図的です」「仕様です」と返答済みの指摘に対しても、再度同じコメントが投稿される

という問題が発生します。

kyoseiはPRの既存会話(コメント、インラインコメント、レビューコメントなど)を事前に収集し、
既に指摘済みの内容やresolvedされたコメント、意図的であると返答済みの指摘を除外することで、
本当に必要な新しいフィードバックだけを提供します。

#### コスト削減のため変更のない場合レビューをスキップ

前回のkyoseiレビューと比較して以下のような形で実コードに変更がない場合、

- masterのマージのみ
- dependabot/renovateのrebase
- `--no-edit`での署名し直しなど

サブエージェントによる詳細調査をスキップして前回判定を引き継いだ簡易レビューを投稿します。
これによりLLMの使用量を削減して、
rate limitに達するリスクを減らします。

レビュー本文末尾に付与されているメタデータフッターから前回対象コミットを復元することで、
force pushでコミットSHAが変わったケースも追跡します。

#### ローカルでも実行できます

kyoseiはCIだけでなくローカルでも実行できるため、
pushしてCIの完了を待つことなく手元で即座にレビューを確認でき、
高速にイテレーションを回すことができます。

#### プロジェクト特有のノイズの除去

claude-code-actionのエージェントに含まれている、
プロジェクト固有のコーディング規約によるノイズを除外しています。

例えばclaude-code-actionのcode-quality-reviewerエージェントには

> Prefer `type` over `interface` as per project standards

と言ったTypeScript固有の指示が含まれていますが、
これはレビュー対象がTypeScriptを含まないプロジェクトであっても適用されてしまいます。

そういったプロジェクト固有の規約は`CLAUDE.md`やプラグインで指定することを想定して、
レビュースキル自体からは削除しています。

## 前提条件

- Node.js version 20.20以上。GitHub Actionsの`ubuntu-24.04`に標準同梱されているバージョンに合わせています。
- npm。Node.jsに同梱されているはず。

セッション開始時にビルド済みでなければ`npm ci`と`npm run build`が自動実行されます。

## インストール

このプラグインをインストールする前に、
[ncaq/konoka](../../README.md)マーケットプレイスをClaude Codeに追加してください。

Claude Codeで以下を実行します。

```text
/plugin install kyosei@konoka
```

または`.claude/settings.json`に追加します。

```json
{
  "enabledPlugins": {
    "kyosei@konoka": true
  }
}
```

## 使い方

### ローカルでの実行

Claude Codeで以下のコマンドを実行します。

```
/kyosei
```

ベースブランチとの差分をレビューして結果を直接出力します。
PRが紐づいたブランチでも、
引数なしの実行ではGitHubへのコメント投稿は行いません。

### ローカルからのPRレビュー(GitHub投稿モード)

引数にPRのURLを渡すと、
CIと同様にGitHub PRへインラインコメントとして投稿します。

例:

```
/kyosei https://github.com/ncaq/konoka/pull/42
```

ブラウザからPRのURLをそのままコピペするだけで実行できます。

外部からのPRでシークレットを渡す用意をしてない時に、
ローカルから直接PRレビューを実行したい場合に使えます。

### CI(GitHub Actions)での実行

[.github/workflows/kyosei.yml](../../.github/workflows/kyosei.yml)
を参考に、
リポジトリの`.github/workflows/`にワークフローを配置してください。
PRがopenされるか更新されると自動でレビューが実行され、
結果がPRにインラインコメントとして投稿されます。

`CLAUDE_CODE_OAUTH_TOKEN`シークレットの設定が必要です。

`claude --bare setup-token`で取得してください。

## レビューメタデータ

GitHub PRに投稿される本体コメントの末尾には、
`<details>`折りたたみで以下のメタデータが自動付与されます。
レビュー対象のコミットや、
レビューを実施した環境データを後から辿るために入れています。
通常あまり人間が読む必要がないものなので、
デフォルトでは折りたたまれています。

- レビュー対象コミット
- PR番号
- kyoseiバージョン
- kyosei-actionバージョン(環境変数`KYOSEI_ACTION_VERSION`が設定されているとき)
- Claude Codeバージョン
- モデル
- 実行環境(GitHub Actions / Claude Code CLI / unknown)とRun URL

取得できなかった項目は`unknown`として表示されます。

## サブエージェント

| エージェント           | 観点                                       |
| ---------------------- | ------------------------------------------ |
| code-quality-reviewer  | コード品質、命名、DRY原則、SOLID原則       |
| dependency-reviewer    | 依存関係の変更内容とプロジェクトへの影響   |
| documentation-reviewer | ドキュメントと実装の整合性                 |
| performance-reviewer   | アルゴリズム計算量、N+1問題、メモリリーク  |
| security-reviewer      | OWASP Top 10、インジェクション、認証/認可  |
| test-reviewer          | テストカバレッジ、テスト品質、欠落シナリオ |

dependency-reviewerは差分に依存関係の変更が含まれている場合に、
リリースノートやコミュニティの反応を調査して影響を評価します。
[research@konoka](../research/)プラグインが利用可能な場合は`/research`スキルを活用し、
利用できない場合は直接Web検索やMCPで調査します。

## ライセンス

Apache-2.0
