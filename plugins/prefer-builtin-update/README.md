# prefer-builtin-update

Bashツール経由のsed/perl/Pythonなどによるファイル置換を抑止して、
組み込みの`Edit`ツールへ誘導するClaude Codeプラグインです。

## インストール

このプラグインをインストールする前に、
[ncaq/konoka](../../README.md)マーケットプレイスをClaude Codeに追加してください。

Claude Codeで以下を実行します。

```text
/plugin install prefer-builtin-update@konoka
```

または`.claude/settings.json`に追加します。

```json
{
  "enabledPlugins": {
    "prefer-builtin-update@konoka": true
  }
}
```

## 提供される機能

### スキル

`prefer-builtin-update`スキルが、
ファイルの書き換えには`Edit`ツールを使うべき理由と、
大量の機械的置換のような例外の扱いをモデルへ伝えます。

### PreToolUseフック

PreToolUseフックでBashツールのコマンドを監視し、
以下を検出した場合は理由付きで拒否して`Edit`ツールへ誘導します。

- `sed -i`や`perl -i`や`ruby -i`のようなin-place編集フラグ
- `python`/`node`/`ruby`/`perl`のワンライナーやヒアドキュメントに、
  `open(..., "w")`や`writeFileSync`のような書き込みパターンが含まれる場合

読み取り専用の用途(`sed -n`によるフィルタや`python3 script.py`の実行など)は基本的に素通ししますが、
後述の通り誤検知はあります。

大量の機械的置換で`Edit`ツールでは現実的でない場合は、
置換処理をスクリプトファイルとして書き出してから実行してください。
スクリプトファイルの実行は検出対象外なので、
フックに拒否されずに実行できます。
拒否時の誘導メッセージでも同じ手順を案内しています。

## 位置づけと限界

このフックはblocklist方式なので、
書き換えパターンを網羅的に検出することは原理的にできません。
例えばリダイレクトによる書き込みや、
検出対象外の言語による書き換えは素通しします。
モデルの癖を矯正してリトライ往復を削減するための補助動作であり、
セキュリティ境界ではありません。

逆に読み取り専用のコマンドを誤検知して拒否することもあります。
`-i`を含む結合フラグを一律にin-place編集とみなすため、
`perl -Mstrict`や`ruby -Ilib`のようなコマンドも拒否されます。
`open('a')`のようにファイル名が書き込みモードの文字そのものの場合も、
書き込みと誤判定されます。
誤検知に当たった場合も`Edit`ツールやスクリプトファイルの実行で代替してください。

クォートやヒアドキュメント内の文字列まで完全に解析するのは困難なため、
`echo "sed -i"`のような稀な誤マッチは許容しています。

## 実装

フック本体はRustバイナリ`prefer-builtin-update`です。
Bashツール毎に呼ばれるため起動コストを抑える目的で、
ネイティブバイナリで実装しています。

複合コマンド(`cd foo && sed -i ...`)やヒアドキュメントも検査対象にするため、
コマンドのprefixによる絞り込みはせずに全てのBashツール呼び出しで起動します。

SessionStartフックの`hooks/build`が初回セッションで`cargo build --release`を走らせ、
`target/release/prefer-builtin-update`を生成します。
ビルド成果物はGitで追跡せず、
プラグイン更新時は再ビルドされます。

よって利用するには`cargo`(Rust toolchain)が必要です。

OpenCode連携ではスキルのみが機能し、
フックは機能しません。

## ライセンス

Apache-2.0
