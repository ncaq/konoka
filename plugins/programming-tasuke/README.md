# programming-tasuke

General-purpose programming guidance for AI coding assistants.

特定の言語やエコシステムに依存しない、
汎用的なプログラミングのガイダンスを提供するClaude Codeプラグインです。

命名規則、コマンドの使い分け、GitHubアクセス方法、エラー処理、テスト方針など、
おおよその開発環境で共通して役立つ知識を扱います。

## インストール

このプラグインをインストールする前に、[ncaq/konoka](../../README.md)マーケットプレイスをClaude Codeに追加してください。

Claude Codeで以下を実行します。

```text
/plugin install programming-tasuke@konoka
```

または`.claude/settings.json`に追加します。

```json
{
  "enabledPlugins": {
    "programming-tasuke@konoka": true
  }
}
```

## 提供される機能

### スキル(背景知識)

汎用プログラミングの知識をスキルとして提供します。
Claudeが関連するコンテキストを検出すると自動的に参照するため、
ユーザーが明示的に呼び出す必要はありません。

| スキル           | 内容                                                                |
| ---------------- | ------------------------------------------------------------------- |
| `command`        | `cat`, `find`, `grep`, `head`, `tail`の代替ツールの推奨と`rm`の禁止 |
| `github`         | GitHubの情報取得・操作で直接URLを叩かずMCPや`gh` CLIを推奨          |
| `naming-rule`    | `common`や`util`など意味のない単語の禁止、原形単数の推奨            |
| `test`           | テストコードを安易に変更しない、テストデータに依存した実装をしない  |
| `use-error-info` | catchやcaseで受け取ったエラーデータをログ等に活用し、安易に捨てない |

### フック

PreToolUseフックでBashツールのコマンドを監視し、
`rm <ファイル>`のようなフラグなしの単純な形に限り`trash`へ自動的に書き換えてから実行します。
ユーザー側のグローバル設定で`rm`がdenyされている前提で、
リトライ往復を削減するための補助動作です。

`rm`と`trash`はフラグ仕様に互換性がないため、
`rm -rf`のようなフラグ付きの形は書き換えずに通常の承認フロー(deny含む)に任せます。

フック本体は`src/main.rs`のRustバイナリ`rm-to-trash`です。
Bashツール毎に呼ばれるため起動コストを抑える目的で、シェル+`jq`/`sed`を避けてネイティブバイナリで実装しています。
SessionStartフックの`hooks/build`が初回セッションで`cargo build --release`を走らせ、
`target/release/rm-to-trash`を生成します。
ビルド成果物はGitで追跡せず、プラグイン更新時は再ビルドされます。

`cargo`(Rust toolchain)と`trash`コマンドが必要です。
trash-cliなどのfreedesktop互換実装を想定しています。

単語境界はシェルのトークン境界(行頭/末、空白、`;`, `&`, `|`, `()`, `` ` ``)で判定するため、
`rmdir`や`rm-utility`のように`rm`が他の文字と連続する形は対象外です。
クォートやヒアドキュメント内の`rm`まで完全に分離するのは困難なため、
`echo "rm a"`のような稀な誤マッチは許容しています。

## ライセンス

Apache-2.0
