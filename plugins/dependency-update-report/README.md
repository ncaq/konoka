# dependency-update-report

依存関係の更新内容とプロジェクトへの影響を調査・報告するClaude Codeプラグインです。

変更の調査、
リンターの実行、
コードベースへの影響評価を行い、
Markdownレポートを作成します。

## インストール

このプラグインをインストールする前に、[ncaq/konoka](../../README.md)マーケットプレイスをClaude Codeに追加してください。

Claude Codeで以下を実行します。

```text
/plugin install dependency-update-report@konoka
```

または`.claude/settings.json`に追加します。

```json
{
  "enabledPlugins": {
    "dependency-update-report@konoka": true
  }
}
```

## 使い方

Claude Codeで`/dependency-update-report`スキルを呼び出してください。

プロジェクトのリンター実行時に、
allowed-toolsに含まれないコマンドの場合は承認が必要になることがあります。

## MCPサーバー(要設定)

ユーザー環境に設定されている場合、以下のMCPサーバーの利用を試みます。
設定されていない場合はWeb検索等で代替されます。

| ソース                                          | 用途                   |
| ----------------------------------------------- | ---------------------- |
| [deepwiki](https://deepwiki.com/)               | リポジトリドキュメント |
| [GitHub](https://github.com/)                   | リリースノート、PR確認 |
| [MDN](https://developer.mozilla.org/)           | Web技術リファレンス    |
| [Microsoft Learn](https://learn.microsoft.com/) | Microsoftドキュメント  |
| [NixOS](https://nixos.org/)                     | nixpkgs情報            |

## ライセンス

Apache-2.0
