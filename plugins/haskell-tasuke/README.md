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

### スキル

Haskell開発を支援するスキルを提供します。

| スキル                   | 内容                                                           |
| ------------------------ | -------------------------------------------------------------- |
| `bump-cabal-index-state` | Cabalプロジェクトの`index-state`を最新に更新し、PR作成まで行う |

`bump-cabal-index-state`は`/bump-cabal-index-state`のように明示的に呼び出して使用します。

## ライセンス

Apache-2.0
