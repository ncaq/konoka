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

## ライセンス

Apache-2.0
