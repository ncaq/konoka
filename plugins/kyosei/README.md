# kyosei

Code review for PRs or local changes. Covers code quality, performance, test coverage, documentation accuracy, and security.

専門サブエージェントを並列起動して包括的なコードレビューを行うClaude Codeプラグインです。

## インストール

Before installing this plugin, first add the [ncaq/konoka](../../README.md) marketplace to Claude Code.

In Claude Code.

```text
/plugin install kyosei@konoka
```

Or in project `.claude/settings.json`.

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
