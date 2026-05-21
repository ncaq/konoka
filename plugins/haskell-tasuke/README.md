# haskell-tasuke

Haskell開発のためのClaude Codeプラグインです。

Haskellの知識をカバーしたり、
Haskell開発のためのツールを提供します。

## インストール

このプラグインをインストールする前に、
[ncaq/konoka](../../README.md)マーケットプレイスをClaude Codeに追加してください。

Claude Codeで以下を実行します。

```text
/plugin install haskell-tasuke@konoka
```

または`.claude/settings.json`に追加します。

```json
{
  "enabledPlugins": {
    "haskell-tasuke@konoka": true
  }
}
```

## 提供される機能

### スキル(知識)

Haskell開発の知識をスキルとして提供します。
Claudeが関連するコンテキストを検出すると自動的に参照するため、
ユーザーが明示的に呼び出す必要はありません。

## ライセンス

Apache-2.0
