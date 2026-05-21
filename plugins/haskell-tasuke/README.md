# haskell-tasuke

Haskell開発のためのClaude Codeプラグインです。

Haskellの知識をカバーしたり、
Haskell開発のためのツールを提供します。

## インストール

このプラグインをインストールする前に、
[ncaq/konoka](../../README.md)マーケットプレイスをClaude Codeに追加してください。

Claude Codeで以下を実行します。

```text
/plugin install haskell-tasuke@konoka
```

または`.claude/settings.json`に追加します。

```json
{
  "enabledPlugins": {
    "haskell-tasuke@konoka": true
  }
}
```

## 提供される機能

### 知識スキル

Haskell開発の知識をカバーします。

| スキル                | 内容                                                |
| --------------------- | --------------------------------------------------- |
| `exception`           | 例外処理とエラー伝播の方針                          |
| `export`              | モジュールのexportの使用方針                        |
| `io-monad`            | `IO`を直接使わず`MonadIO`/`MonadUnliftIO`を使う方針 |
| `language-extensions` | Haskellの言語拡張・言語バージョン                   |
| `partial-function`    | `fromJust`や`head`など部分関数を禁止する            |
| `unsafe`              | `unsafePerformIO`など`unsafe`接頭辞の関数を禁止する |
| `warning`             | GHCやhlintの警告を安易に無効化しないため            |

知識スキルはClaudeが関連するコンテキストを検出すると自動的に参照します。

### 呼び出しスキル

Haskell開発のためのツールを提供します。

| スキル                   | 内容                                                           |
| ------------------------ | -------------------------------------------------------------- |
| `bump-cabal-index-state` | Cabalプロジェクトの`index-state`を最新に更新し、PR作成まで行う |

`bump-cabal-index-state`は`/bump-cabal-index-state`のように明示的に呼び出して使用します。

## ライセンス

Apache-2.0
