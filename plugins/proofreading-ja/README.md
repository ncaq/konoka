# proofreading-ja

Fix typos, grammar, readability, and notation consistency in Japanese text. Use when the user wants to proofread or edit Japanese text.

日本語文章の校正・推敲を行うClaude Codeプラグインです。

誤字脱字、文法・表現、読みやすさ、表記統一、技術的正確性の観点で記事を校正します。
gitログから最新の記事ファイルを自動特定し、修正がなくなるまで反復的に校正を行います。

## インストール

このプラグインをインストールする前に、[ncaq/konoka](../../README.md)マーケットプレイスをClaude Codeに追加してください。

Claude Codeで以下を実行します。

```text
/plugin install proofreading-ja@konoka
```

または`.claude/settings.json`に追加します。

```json
{
  "enabledPlugins": {
    "proofreading-ja@konoka": true
  }
}
```

## 使い方

Claude Codeで`/proofreading-ja`スキルを呼び出してください。

## ライセンス

Apache-2.0
