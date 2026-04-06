# nix-tasuke

Nix best practices, command patterns, and more guidance for AI coding assistants.

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

## 提供される機能

### スキル(背景知識)

Nixの命名規則、関数の使い分け、ツールの設定方法などの知識をスキルとして提供します。
Claudeが関連するコンテキストを検出すると自動的に参照するため、ユーザーが明示的に呼び出す必要はありません。

### フック

Claudeの応答完了時(Stopイベント)に`nix fmt`を自動実行します。
フォーマットの自動適用とリンターのチェックが行われ、
エラーがあればClaude Codeにフィードバックされます。

以下の条件を満たさないプロジェクトでは自動的にスキップされます。

- プロジェクトルートに読み込み可能な`flake.nix`が存在すること
- プロジェクトがGitリポジトリであること

`nix`, `git`, `xargs`コマンドが必要です。

### MCPサーバー

このプラグインはNix関連のMCPサーバーを同梱しています。
プラグインを有効化するだけで、ユーザー側のMCP設定なしにツールが利用可能になります。

| サーバー名 | エンドポイント                   | 提供ツール                           |
| ---------- | -------------------------------- | ------------------------------------ |
| nixos      | `https://mcp-nixos.ncaq.net/mcp` | NixOS/home-managerオプション検索など |

バックエンドの実装には[utensils/mcp-nixos](https://github.com/utensils/mcp-nixos)を使用しています。

#### ホスティングについて

MCPサーバーはncaqの自宅サーバーでホスティングしています。
認証なしのパブリックなHTTPエンドポイントです。

- 自宅サーバーのため、メンテナンスや障害でダウンすることがあります
- ncaqのプライベートホスティングを信用できない場合は、このプラグインの利用を避けてください。
  ncaqが開発したプラグインを利用する以上、ホスティングも含めて信用する前提です

## ライセンス

Apache-2.0
