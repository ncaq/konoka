# bump-cabal-index-state

Update Cabal project index-state to the latest timestamp.

Cabalプロジェクトの`index-state`を最新に更新するClaude Codeプラグインです。
`cabal.project`、`cabal.project.local`、`flake.nix`などに記載された`index-state`を更新します。
haskell.nixの対応遅れにも対応しており、認識済みの最新値に自動フォールバックします。
ビルド確認後、GitHubへのpushとPR作成まで行います。

## インストール

Before installing this plugin, first add the [ncaq/konoka](../../README.md) marketplace to Claude Code.

In Claude Code.

```text
/plugin install bump-cabal-index-state@konoka
```

Or in project `.claude/settings.json`.

```json
{
  "enabledPlugins": {
    "bump-cabal-index-state@konoka": true
  }
}
```

## 使い方

Claude Codeで`/bump-cabal-index-state`スキルを呼び出してください。

## ライセンス

Apache-2.0
