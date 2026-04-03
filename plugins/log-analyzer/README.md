# log-analyzer

Extract key information from verbose command output while keeping main conversation context lean.

長大なコマンド出力やログファイルから重要情報を抽出するClaude Codeプラグインです。
メイン会話のコンテキスト消費を抑えたい場合に使用します。

## インストール

Before installing this plugin, first add the [ncaq/konoka](../../README.md) marketplace to Claude Code.

In Claude Code.

```text
/plugin install log-analyzer@konoka
```

Or in project `.claude/settings.json`.

```json
{
  "enabledPlugins": {
    "log-analyzer@konoka": true
  }
}
```

## 使い方

Claude Codeがlog-analyzerエージェントを自動的に利用可能になります。
ビルドログやテスト出力など長大なコマンド出力の解析が必要な場面で、メインのコンテキストから分離されたサブエージェントとして起動されます。

## 動作

1. コマンドを実行して出力をキャプチャ、または既存のログファイルを読み込み
2. `/tmp/coding-agent-work/log-analyzer/`にログファイルを保存
3. 出力全体を解析
4. 重大度別に整理したレポートを報告

## レポート構造

| 重大度    | 内容                               |
| --------- | ---------------------------------- |
| 🔴 エラー | 対処が必要な致命的な問題           |
| 🟡 警告   | 確認すべき潜在的な問題             |
| 🔵 情報   | 関連する可能性のある注目すべき情報 |

## ライセンス

Apache-2.0
