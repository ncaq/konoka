# log-analyzer

Extract key information from verbose command output while keeping main conversation context lean.

長大なコマンド出力やログファイルから重要情報を抽出するClaude Codeプラグインです。
メイン会話のコンテキスト消費を抑えたい場合に使用します。

## インストール

このプラグインをインストールする前に、
[ncaq/konoka](../../README.md)マーケットプレイスをClaude Codeに追加してください。

Claude Codeで以下を実行します。

```text
/plugin install log-analyzer@konoka
```

または`.claude/settings.json`に追加します。

```json
{
  "enabledPlugins": {
    "log-analyzer@konoka": true
  }
}
```

## セットアップ

このプラグインはログファイルを`$XDG_RUNTIME_DIR/coding-agent-work/log-analyzer/`配下に、
タイムスタンプ付きのサブディレクトリを作成して保存します。
Claude Codeの自動承認ディレクトリに追加することを推奨します。

### 環境変数の確認

```bash
echo $XDG_RUNTIME_DIR
```

典型的なデフォルト値:

| ディストリビューション                     | パス                           |
| ------------------------------------------ | ------------------------------ |
| systemd搭載Linux (NixOS, Ubuntu, Fedora等) | `/run/user/<uid>`              |
| macOS                                      | 未設定(`/tmp`にフォールバック) |

### 自動承認ディレクトリの追加

`~/.claude/settings.json`に以下を追加してください。
`<uid>`は`id -u`の出力に置き換えてください。

```json
{
  "permissions": {
    "additionalDirectories": ["/run/user/<uid>/coding-agent-work/"]
  }
}
```

現時点ではClaude Codeの`additionalDirectories`は環境変数を展開しないため、
絶対パスで指定する必要があります。

`$XDG_RUNTIME_DIR`が未設定の環境では`/tmp`にフォールバックします。

## 使い方

Claude Codeがlog-analyzerスキルを自動的に利用可能になります。
ビルドログやテスト出力など長大なコマンド出力の解析が必要な場面で、
`context: fork`によりメインのコンテキストから分離されたサブエージェントとして実行されます。

## 動作

1. コマンドを実行して出力をキャプチャ、または既存のログファイルを読み込み
2. `$XDG_RUNTIME_DIR/coding-agent-work/log-analyzer/`配下のタイムスタンプ付きサブディレクトリにログファイルを保存
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
