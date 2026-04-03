# research

Cross-source search for technical investigation, documentation lookup, library issue/PR tracking, and package information retrieval.

複数の情報ソースを横断検索して技術調査を行うClaude Codeプラグインです。

## インストール

このプラグインをインストールする前に、[ncaq/konoka](../../README.md)マーケットプレイスをClaude Codeに追加してください。

Claude Codeで以下を実行します。

```text
/plugin install research@konoka
```

または`.claude/settings.json`に追加します。

```json
{
  "enabledPlugins": {
    "research@konoka": true
  }
}
```

## 使い方

Claude Codeがresearchエージェントを自動的に利用可能になります。
技術調査や情報収集が必要な場面で、メインのコンテキストから分離されたサブエージェントとして起動されます。

## 情報ソース

### MCPサーバー(要設定)

ユーザー環境に設定されている場合、以下のMCPサーバーの利用を試みます。
設定されていない場合は他のソース(Web検索等)で代替されます。

| ソース                                                | 内容                             |
| ----------------------------------------------------- | -------------------------------- |
| [Backlog](https://backlog.com/)                       | 課題、Wiki、PR                   |
| [Cloudflare Docs](https://developers.cloudflare.com/) | Cloudflareドキュメント検索       |
| [deepwiki](https://deepwiki.com/)                     | GitHubリポジトリのAIドキュメント |
| [GitHub](https://github.com/)                         | コード検索、Issue/PR確認         |
| [MDN](https://developer.mozilla.org/)                 | Web技術リファレンス              |
| [Microsoft Learn](https://learn.microsoft.com/)       | Microsoftドキュメント            |
| [NixOS](https://nixos.org/)                           | nixpkgs、home-manager、flakes    |

### 常時利用可能

| ソース           | 内容             |
| ---------------- | ---------------- |
| Web検索          | 一般的なWeb検索  |
| WebFetch         | 任意のURL取得    |
| ローカルファイル | Glob、Grep、Read |

## ライセンス

Apache-2.0
