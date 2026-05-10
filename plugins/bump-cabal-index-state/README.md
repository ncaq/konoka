# bump-cabal-index-state

Update Cabal project index-state to the latest timestamp.

Cabalプロジェクトの`index-state`を最新に更新するClaude Codeプラグインです。

- `cabal.project`
- `cabal.project.local`
- `flake.nix`

などに記載された`index-state`を更新します。
haskell.nixの対応遅れにも対応しており、
認識済みの最新値に自動フォールバックします。

ビルド確認後、
GitHubへのpushとPR作成まで行います。

## インストール

このプラグインをインストールする前に、
[ncaq/konoka](../../README.md)マーケットプレイスをClaude Codeに追加してください。

Claude Codeで以下を実行します。

```text
/plugin install bump-cabal-index-state@konoka
```

または`.claude/settings.json`に追加します。

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
