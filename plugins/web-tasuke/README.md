# web-tasuke

Web development best practices, patterns, and guidance for AI coding assistants.

Web開発のベストプラクティスやパターンなどを提供するClaude Codeプラグインです。

HTML, TypeScript, JavaScript, React, アクセシビリティなど、
Web技術全般をカバーします。

## インストール

このプラグインをインストールする前に、[ncaq/konoka](../../README.md)マーケットプレイスをClaude Codeに追加してください。

Claude Codeで以下を実行します。

```text
/plugin install web-tasuke@konoka
```

または`.claude/settings.json`に追加します。

```json
{
  "enabledPlugins": {
    "web-tasuke@konoka": true
  }
}
```

## 提供される機能

### スキル(背景知識)

HTMLのより良い書き方、
TypeScriptの型の活用や命名規則のベストプラクティスと言った、
Web開発の知識をスキルとして提供します。

Claudeが関連するコンテキストを検出すると自動的に参照するため、
ユーザーが明示的に呼び出す必要はありません。

### MCPサーバー

このプラグインは[Context7](https://context7.com/)のMCPサーバーの設定を同梱しています。
プラグインを有効化するだけで、
ライブラリやフレームワークの最新ドキュメントを参照するツールが利用可能になります。

#### Context7のAPIキーについて

Context7はAPIキーなしでも利用可能ですが、
匿名アクセスではグローバルで60リクエスト/時のレート制限を共有します。

より多くのリクエストが必要な場合は、
[Context7のダッシュボード](https://context7.com/dashboard)でAPIキーを取得し、
環境変数`CONTEXT7_API_KEY`に設定してください。

```bash
export CONTEXT7_API_KEY="ctx7sk-..."
```

プラグインの`.mcp.json`では`${CONTEXT7_API_KEY:-}`という記法を使用しています。
Claude Codeの`.mcp.json`ではbash風の`${VAR:-default}`構文がサポートされており、
環境変数が未設定の場合にデフォルト値が使われます。
`${CONTEXT7_API_KEY:-}`はデフォルト値が空文字列なので、
未設定時は`Authorization: Bearer `(空トークン)がヘッダーに送信されます。

Context7は空のBearerトークンを受け取った場合でもエラーにならず、
匿名アクセスとして扱います。
そのためAPIキー未設定でもMCPサーバーの接続自体は正常に動作します。

## ライセンス

Apache-2.0
