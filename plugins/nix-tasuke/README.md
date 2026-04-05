# nix-tasuke

Nix best practices, command patterns and etc guidance for AI coding assistants.

Nixのベストプラクティスやコマンドのガイダンスなどを提供するClaude Codeプラグインです。

## インストール

このプラグインをインストールする前に、[ncaq/konoka](../../README.md)マーケットプレイスをClaude Codeに追加してください。

Claude Codeで以下を実行します。

```text
/plugin install nix-tasuke@konoka
```

または`.claude/settings.json`に追加します。

```json
{
  "enabledPlugins": {
    "nix-tasuke@konoka": true
  }
}
```

## ライセンス

Apache-2.0
