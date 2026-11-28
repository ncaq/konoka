---
name: prefer-yq
description: Prefer yq over Python or ad-hoc text substitution for reading or transforming YAML, XML, TOML, and CSV. Assumes mikefarah/yq, whose syntax differs from the Python-based kislyuk/yq. Use when reading or rewriting configuration files in those formats from the command line.
user-invocable: false
---

# YAMLなどの処理にはyqを優先する

YAMLやXMLやTOMLやCSVといった構造化データを読み取ったり変換したりする用事には、`yq`を使ってください。
Pythonなどの汎用スクリプト言語や、`sed`による場当たり的なテキスト置換は持ち出しません。

JSONにはyqではなくjqを使います。
yqでもJSONは扱えますが、形式ごとに道具を使い分けた方が読み手に意図が伝わるためです。
`programming-tasuke:prefer-jq`スキルを参照してください。

汎用スクリプト言語は何でも出来てしまうので、
コマンドの実行を承認する人間は、毎回スクリプトの中身を読んで安全性を判断することになります。
`Bash(python:*)`のような包括的な許可を出すのも危険です。
yqに出来ることはデータの変換にほぼ限られていて副作用が少ないので、
包括的な許可を出しやすく、承認の手間が発生しません。
インデントやアンカーの扱いを自前で組み立てるより、yqに任せた方が短く書けて読みやすいという利点もあります。

`sed`による置換はYAMLの構造を理解しないので、
同じ名前のキーが別の階層にもある場合などに、意図しない箇所まで書き換えてしまいます。
yqはパスを指定して構造として扱うので、その危険がありません。

## 実装の区別

`yq`という名前のコマンドには、互換性のない2つの実装があります。

- mikefarah/yq: Go製の単体バイナリで、nixpkgsでは`yq-go`です。このスキルはこちらを前提にします。
- kislyuk/yq: Python製のjqラッパーで、nixpkgsでは`yq`です。フィルタの構文はjqと同一です。

書いたフィルタが構文エラーになったときは、実装の違いを疑って`yq --version`で判別してください。
mikefarah版は`yq (https://github.com/mikefarah/yq/) version v4.53.2`のように出力します。

## 入力形式と出力形式

入力形式の既定は`auto`で、ファイルの拡張子から判別されます。
判別できない入力は黙ってYAMLとして解釈されるので、気付かないまま誤った結果を得ることがあります。
標準入力や、`.txt`のように中身と一致しない拡張子のファイルを渡すときは、`-p`で入力形式を明示してください。
`-p`は`auto`, `yaml`, `kyaml`, `json`, `props`, `csv`, `tsv`, `xml`, `base64`, `uri`, `toml`, `hcl`, `lua`, `ini`をサポートします。

出力形式の既定も`auto`ですが、入力形式ではなく入力ファイルの拡張子から決まり、
判別できなければYAMLになります。
JSONが欲しいときは`-o=json`を付けます。

`-p`を付けても出力形式は連動しないので、`-p`を付けるときは`-o`で出力形式も明示してください。
`-o`を省くと出力はYAMLになり、入力がファイルならYAMLへ倒した旨の警告も出ます。

```console
yq -p=xml -o=yaml '.root.item' response.txt
```

リモートから取得したデータは、`curl`からyqへ直接パイプせず、
一度ファイルへ保存して中身を確認してから処理してください。
想定と違う形式や巨大なデータが返っていることに気付けるためです。

## jqとの違いで戸惑いやすい点

- シェルの値は、フィルタへ文字列として連結せずに環境変数を経由して渡します。
  jqの`--arg`の代わりに、`env(NAME)`か`strenv(NAME)`で参照します。
- スカラーの展開は出力形式によって変わります。
  YAML出力では既定でクォートなしに展開されますが、`-o=json`では`"a"`のようにクォートが付きます。
  生の値が欲しいときは、`--unwrapScalar`の短縮形である`-r`を明示してください。
- `-s`はjqのslurpではなく`--split-exp`で、式の評価結果を名前にしたファイルを生成します。
  入力をまとめたいときは`eval-all`や`[...]`を使います。
- 複数のファイルやドキュメントを横断して処理するときは`eval-all`を使います。

```console
version=2 yq -i '.version = strenv(version)' compose.yaml

yq eval-all '. as $item ireduce ({}; . * $item)' base.yaml override.yaml
```

## ファイルの書き換え

`-i`を付けると入力ファイルを直接書き換えます。
コメントは保持されます。

リポジトリ内の設定ファイルを人間が読む前提で書き換えるときは、`Edit`ツールを優先してください。
差分が読みやすいためです。
`yq -i`は、多数のファイルへ同じ変更を機械的に適用する場合などに使います。

## 例外

以下の場合はPythonなどを使って構いません。
その場合でも、値を取り出す部分だけをyqへ切り出せるなら切り出してください。

- HTTP通信やファイルシステムの操作など、データの変換以外の副作用が処理の本体である場合。
- スキーマ検証やテンプレート展開など、yqの機能では表現が極端に複雑になる場合。
- 既存のPythonプロジェクトの一部としてコードを書く場合。
- 実行環境にyqが入っていない場合。
