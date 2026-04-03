# kyosei

Code review for PRs or local changes. Covers code quality, performance, test coverage, documentation accuracy, and security.

専門サブエージェントを並列起動して包括的なコードレビューを行うClaude Codeプラグインです。

## モチベーション

Claude Codeの`install-github-app`でインストールされるClaude Code Reviewのワークフローは、
同じPRに対してpush後の再レビューを行いません。
初回のレビュー以降、コードを修正してpushしても新たなレビューが実行されないため、
指摘事項への対応が正しく行われたかを自動で確認できないという致命的な問題があります。

kyoseiは、
[claude-code-action](https://github.com/anthropics/claude-code-action)
リポジトリが採用しているレビューパターンをベースにこの問題を解決しています。

ただしclaude-code-actionを直接使う場合にも以下の問題があるので、
kyoseiではさらに改善を加えています。

- 同じPRにpushを繰り返すと、既に指摘済みの同じコメントが何度も投稿される
- 「意図的です」「仕様です」と返答済みの指摘に対しても、再度同じコメントが投稿される

kyoseiはPRの既存会話(コメント、インラインコメント、レビューコメント)を事前に収集し、
既に指摘済みの内容やresolvedされたコメント、意図的であると返答済みの指摘を除外することで、
本当に必要な新しいフィードバックだけを提供します。

さらにkyoseiはCIだけでなくローカルでも実行できるため、
pushしてCIの完了を待つことなく手元で即座にレビューを確認でき、
高速にイテレーションを回すことができます。

またclaude-code-actionのエージェントに含まれている、
プロジェクト固有のコーディング規約によるノイズを除外しています。
例えばclaude-code-actionのcode-quality-reviewerエージェントには「Prefer `type` over `interface` as per project standards」というTypeScript固有の指示が含まれていますが、
これはレビュー対象がTypeScriptを含まないプロジェクトであっても適用されてしまいます。
そういったプロジェクト固有の規約は`CLAUDE.md`などで指定することを想定しています。

## インストール

このプラグインをインストールする前に、[ncaq/konoka](../../README.md)マーケットプレイスをClaude Codeに追加してください。

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

引数にリポジトリとPR番号を渡すと、
CIと同様にGitHub PRへインラインコメントとして投稿します。

```
/kyosei REPO:owner/repo PR_NUMBER:123
```

外部からのPRでシークレットを渡す用意をしてない時に、
ローカルから直接PRレビューを実行したい場合に使えます。

### CI(GitHub Actions)での実行

[.github/workflows/claude-code-review.yml](../../.github/workflows/claude-code-review.yml)
を参考に、
リポジトリの`.github/workflows/`にワークフローを配置してください。
PRがopenされるか更新されると自動でレビューが実行され、
結果がPRにインラインコメントとして投稿されます。

`CLAUDE_CODE_OAUTH_TOKEN`シークレットの設定が必要です。

`claude --bare setup-token`で取得してください。

## サブエージェント

| エージェント                    | 観点                                       |
| ------------------------------- | ------------------------------------------ |
| code-quality-reviewer           | コード品質、命名、DRY原則、SOLID原則       |
| performance-reviewer            | アルゴリズム計算量、N+1問題、メモリリーク  |
| security-code-reviewer          | OWASP Top 10、インジェクション、認証/認可  |
| test-coverage-reviewer          | テストカバレッジ、テスト品質、欠落シナリオ |
| documentation-accuracy-reviewer | ドキュメントと実装の整合性                 |
| pr-conversation-collector       | PR既存会話の収集(重複コメント回避用)       |

pr-conversation-collectorはCI経由のPRレビュー時のみ実行されます。
収集した既存会話と照合し、
既に指摘済みの内容やresolvedされたコメントと同じ内容は除外されます。

## ライセンス

Apache-2.0
