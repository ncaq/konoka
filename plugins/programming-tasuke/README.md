# programming-tasuke

General-purpose programming guidance for AI coding assistants.

特定の言語やエコシステムに依存しない、
汎用的なプログラミングのガイダンスを提供するClaude Codeプラグインです。

- 命名規則
- コマンドの使い分け
- GitHubアクセス方法
- エラー処理
- テスト方針

など、
おおよその開発環境で共通して役立つ知識を扱います。

## インストール

このプラグインをインストールする前に、
[ncaq/konoka](../../README.md)マーケットプレイスをClaude Codeに追加してください。

Claude Codeで以下を実行します。

```text
/plugin install programming-tasuke@konoka
```

または`.claude/settings.json`に追加します。

```json
{
  "enabledPlugins": {
    "programming-tasuke@konoka": true
  }
}
```

## 提供される機能

### スキル(背景知識)

汎用プログラミングの知識をスキルとして提供します。
Claudeが関連するコンテキストを検出すると自動的に参照するため、
ユーザーが明示的に呼び出す必要はありません。

| スキル                | 内容                                                                |
| --------------------- | ------------------------------------------------------------------- |
| `command`             | `cat`, `find`, `grep`, `head`, `tail`の代替ツールの推奨と`rm`の禁止 |
| `comparison-operator` | 比較は`<`や`<=`を優先し、左から右へ値が大きくなるように書く         |
| `github`              | GitHubの情報取得・操作で直接URLを叩かずMCPや`gh` CLIを推奨          |
| `naming-rule`         | `common`や`util`など意味のない単語の禁止、原形単数の推奨            |
| `test`                | テストコードを安易に変更しない、テストデータに依存した実装をしない  |
| `use-error-info`      | catchやcaseで受け取ったエラーデータをログ等に活用し、安易に捨てない |

### 関連プラグイン

`rm`を`trash`に自動書き換えするPreToolUseフックは別プラグイン[rm-to-trash](../rm-to-trash/README.md)に切り出されています。
本プラグインは汎用的なプログラミング指針のみを扱うため、
自動書き換えが必要な場合はrm-to-trashも併せて有効化してください。

## ライセンス

Apache-2.0
