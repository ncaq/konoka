# rm-to-trash

Bashツール経由の素の`rm`コマンドを`trash`へ自動的に書き換えるClaude Codeプラグインです。

ユーザー側のグローバル設定で`rm`がdenyされている前提で、
リトライ往復を削減するための補助動作として動作します。

## インストール

このプラグインをインストールする前に、
[ncaq/konoka](../../README.md)マーケットプレイスをClaude Codeに追加してください。

Claude Codeで以下を実行します。

```text
/plugin install rm-to-trash@konoka
```

または`.claude/settings.json`に追加します。

```json
{
  "enabledPlugins": {
    "rm-to-trash@konoka": true
  }
}
```

## 提供される機能

PreToolUseフックでBashツールのコマンドを監視し、
`rm <ファイル>`のようなフラグなしの単純な形に限り`trash`へ自動的に書き換えてから実行します。

`rm`と`trash`はフラグ仕様に互換性がないため、
`rm -rf`のようなフラグ付きの形は書き換えずに通常の承認フロー(deny含む)に任せます。

`git rm`は`git trash`サブコマンドが存在せず書き換えると単に動作しなくなるため、
`git rm`を含むコマンドも書き換え対象から除外します。
`git rm`自体を禁止したい場合はユーザ側の`settings.json`等の`deny`設定で制御してください。

フック本体はRustバイナリ`rm-to-trash`です。
Bashツール毎に呼ばれるため起動コストを抑える目的で、
シェルスクリプト+`jq`/`sed`のような実装を避けてネイティブバイナリで実装しています。
SessionStartフックの`hooks/build`が初回セッションで`cargo build --release`を走らせ、
`target/release/rm-to-trash`を生成します。
ビルド成果物はGitで追跡せず、
プラグイン更新時は再ビルドされます。

`cargo`(Rust toolchain)と`trash`コマンドが必要です。
[trash-cli](https://github.com/andreafrancia/trash-cli)を想定しています。

単語境界はシェルのトークン境界(行頭/末、空白、各種記号)で判定するため、
`rmdir`や`rm-utility`のように`rm`が他の文字と連続する形は対象外です。

クォートやヒアドキュメント内の`rm`まで完全に分離するのは困難なため、
`echo "rm a"`のような稀な誤マッチは許容しています。
どうしても置き換えられると困るようなものは`Write`ツールなどで書けば良いので、
`echo`などを使った書き方にそこまで配慮していません。

## ライセンス

Apache-2.0
