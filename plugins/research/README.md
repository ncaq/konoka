# research

Gather up-to-date information from external sources (official docs, GitHub, MDN, Microsoft Learn, NixOS, web search) for comparing libraries, looking up APIs, evaluating approaches, or investigating library behavior. Runs investigations in an isolated context so the main conversation stays uncluttered.

ライブラリの比較、APIの調査、技術選定、ライブラリの挙動調査などを、
公式ドキュメント、GitHub、MDN、Microsoft Learn、NixOS、Web検索といった複数の情報ソースを横断して行うClaude Codeプラグインです。
調査はメインコンテキストから分離された環境で実行されるため、
会話のコンテキストを圧迫しません。

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

技術調査や情報収集が必要な場面でClaude Codeが自動的にresearchスキルを起動します。
`context: fork`により調査はメインコンテキストから分離されるため、
コンテキストを圧迫しません。

クエリは自動的に独立したサブクエリに分解され、
`survey`エージェントが並列起動して調査を行います。
例えばVitestとJestの比較であれば、
それぞれが別のサブクエリとして並列に調査されます。

手動で実行する場合は`/research`スキルを使います。

```text
/research Reactのサーバーコンポーネントについて
```

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

NixOSのMCPサーバーは[nix-tasuke@konoka](../nix-tasuke/)プラグインに同梱されています。
nix-tasukeを導入している場合はnixosの`.mcp.json`設定は不要です。

Backlogは公開HTTPエンドポイントが提供されていないため、MCPサーバーを自分でビルド・ホストする必要があります。

`.mcp.json`の設定例(Backlog以外):

```json
{
  "mcpServers": {
    "cloudflare": {
      "type": "http",
      "url": "https://docs.mcp.cloudflare.com/mcp"
    },
    "deepwiki": {
      "type": "http",
      "url": "https://mcp.deepwiki.com/mcp"
    },
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/"
    },
    "mdn": {
      "type": "http",
      "url": "https://mcp.mdn.mozilla.net/"
    },
    "microsoft-learn": {
      "type": "http",
      "url": "https://learn.microsoft.com/api/mcp"
    },
    "nixos": {
      "type": "http",
      "url": "https://mcp-nixos.ncaq.net/mcp"
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
