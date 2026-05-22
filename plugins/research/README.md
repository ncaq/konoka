# research

- ライブラリの比較
- APIの調査
- 技術選定
- ライブラリの挙動調査

などを、

- 公式ドキュメント
- Context7
- GitHub
- MDN
- Microsoft Learn
- NixOS
- Web検索

といった複数の情報ソースを横断して行うClaude Codeプラグインです。

## インストール

このプラグインをインストールする前に、
[ncaq/konoka](../../README.md)マーケットプレイスをClaude Codeに追加してください。

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

技術調査や情報収集が必要な場面でClaude Codeが自動的にresearchスキルを起動します。

クエリは自動的に独立したサブクエリに分解され、
`survey`エージェントが並列起動して調査を行います。

`survey`エージェントはコスト節約のためと速度のために`sonnet`で動作します。

例えばVitestとJestの比較であれば、
それぞれが別のサブクエリとして並列に調査されます。

手動で実行する場合は`/research`スキルを使います。

```text
/research Reactのサーバーコンポーネントについて
```

## 情報ソース

### 同梱(設定不要)

以下のMCPサーバーはこのプラグインが提供するため、
追加設定なしで利用できます。

| ソース                                                | 内容                             |
| ----------------------------------------------------- | -------------------------------- |
| [Cloudflare Docs](https://developers.cloudflare.com/) | Cloudflareドキュメント検索       |
| [Context7](https://context7.com/)                     | ライブラリの最新ドキュメント     |
| [deepwiki](https://deepwiki.com/)                     | GitHubリポジトリのAIドキュメント |
| [MDN](https://developer.mozilla.org/)                 | Web技術リファレンス              |
| [Microsoft Learn](https://learn.microsoft.com/)       | Microsoftドキュメント            |
| [NixOS](https://nixos.org/)                           | nixpkgs、home-manager、flakes    |

- Cloudflare Docs
- Context7
- deepwiki
- MDN
- Microsoft Learn

はこのプラグインの`.mcp.json`に同梱されています。

NixOSのMCPサーバーは[nix-tasuke@konoka](../nix-tasuke/)プラグインが提供します。
researchはnix-tasukeに依存しているため、
researchを導入すると自動的に有効化されます。

### MCPサーバー(要設定)

以下は同梱できないため、ユーザー環境に設定されている場合のみ利用を試みます。
設定されていない場合は他のソース(Web検索等)で代替されます。

| ソース                          | 内容                     |
| ------------------------------- | ------------------------ |
| [Backlog](https://backlog.com/) | 課題、Wiki、PR           |
| [GitHub](https://github.com/)   | コード検索、Issue/PR確認 |

Backlogは公開HTTPエンドポイントが提供されていないため、
MCPサーバーを自分でビルド・ホストする必要があります。

`.mcp.json`の設定例(GitHub):

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/"
    }
  }
}
```

### 常時利用可能

| ソース           | 内容             |
| ---------------- | ---------------- |
| Web検索          | 一般的なWeb検索  |
| WebFetch         | 任意のURL取得    |
| ローカルファイル | Glob、Grep、Read |

## ライセンス

Apache-2.0
