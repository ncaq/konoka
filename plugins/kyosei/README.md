# kyosei

Code review for PRs or local changes. Covers code quality, performance, test coverage, documentation accuracy, and security.

専門サブエージェントを並列起動して包括的なコードレビューを行うClaude Codeプラグインです。

## インストール

Before install [ncaq/konoka](../../README.md) marketplace.

In Claude Code.

```text
/plugin install kyosei@ncaq-konoka
```

Or In project `.claude/settings.json`.

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
ローカル実行ではGitHubへのコメント投稿は行いません。

### CI(GitHub Actions)での実行

[examples/claude-code-review.yml](examples/claude-code-review.yml)
を参考に、
リポジトリの`.github/workflows/`にワークフローを配置してください。
PRがopenされるか更新されると自動でレビューが実行され、
結果がPRにインラインコメントとして投稿されます。

`CLAUDE_CODE_OAUTH_TOKEN`シークレットの設定が必要です。

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
