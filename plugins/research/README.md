# research

Cross-source search for technical investigation, documentation lookup, library issue/PR tracking, and package information retrieval.

複数の情報ソースを横断検索して技術調査を行うClaude Codeプラグインです。

## インストール

Before installing this plugin, first add the [ncaq/konoka](../../README.md) marketplace to Claude Code.

In Claude Code.

```text
/plugin install research@konoka
```

Or in project `.claude/settings.json`.

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

### プラグイン同梱(認証不要)

| ソース                                                | 内容                             |
| ----------------------------------------------------- | -------------------------------- |
| [Cloudflare Docs](https://developers.cloudflare.com/) | Cloudflareドキュメント検索       |
| [deepwiki](https://deepwiki.com/)                     | GitHubリポジトリのAIドキュメント |
| [MDN](https://developer.mozilla.org/)                 | Web技術リファレンス              |
| [Microsoft Learn](https://learn.microsoft.com/)       | Microsoftドキュメント            |
| [NixOS](https://nixos.org/)                           | nixpkgs、home-manager、flakes    |

これらはプラグインの`.mcp.json`でHTTPエンドポイントとして定義されており、追加設定なしで利用できます。

### ユーザー環境依存(要設定)

| ソース                          | 内容                     |
| ------------------------------- | ------------------------ |
| [GitHub](https://github.com/)   | コード検索、Issue/PR確認 |
| [Backlog](https://backlog.com/) | 課題、Wiki、PR           |

これらはユーザー環境にMCPサーバーが設定されている場合のみ利用されます。
設定されていない場合は他のソース(Web検索等)で代替されます。

### 常時利用可能

| ソース           | 内容             |
| ---------------- | ---------------- |
| Web検索          | 一般的なWeb検索  |
| WebFetch         | 任意のURL取得    |
| ローカルファイル | Glob、Grep、Read |

## ライセンス

Apache-2.0
