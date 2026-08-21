---
name: prefer-yq
description: Prefer yq over Python or ad-hoc text substitution for reading or transforming YAML, XML, TOML, and CSV. Assumes mikefarah/yq, whose syntax differs from the Python-based kislyuk/yq. Use when reading or rewriting configuration files in those formats from the command line.
user-invocable: false
---

# YAMLなどの処理にはyqを優先する

YAMLやXMLやTOMLやCSVといった構造化データを読み取ったり変換したりする用事には、
`yq`を使ってください。
Pythonなどの汎用スクリプト言語や、
`sed`による場当たり的なテキスト置換を持ち出さないでください。

JSONを扱う時はyqではなくjqを使ってください。
yqでもJSONは扱えますが、
形式ごとに道具を使い分けたほうが読み手に意図が伝わります。
`programming-tasuke:prefer-jq`スキルを参照してください。

## 理由

汎用スクリプト言語は何でも出来てしまいます。
コマンドの実行を承認する人間は毎回スクリプトの中身を読んで安全性を判断しなければならず、
`Bash(python:*)`のような包括的な許可を出すことも危険です。
yqの出来ることはデータの変換にほぼ限られていて副作用が少ないため、
包括的な許可を出しやすく、
承認の手間が発生しません。

`sed`による置換はYAMLの構造を理解しないため、
同じ名前のキーが別の階層にもある場合などに、
意図しない箇所まで書き換えてしまいます。
yqはパスを指定して構造として扱うのでその危険がありません。

インデントやアンカーの扱いを自前で組み立てるより、
yqに任せた方が短く書けて読みやすいという利点もあります。

## 実装の区別

`yq`という名前のコマンドには互換性のない2つの実装があります。

- mikefarah/yq: Go製の単体バイナリ。nixpkgsの`yq-go`。このスキルはこちらを前提とします。
- kislyuk/yq: Python製のjqラッパー。nixpkgsの`yq`。フィルタの構文はjqと同一です。

構文が違うので、
書いたフィルタが構文エラーになった時は実装の違いを疑ってください。
`yq --version`で判別できます。
mikefarah版は`yq (https://github.com/mikefarah/yq/) version v4.53.2`のように出力します。

## 使い方

読み取り。

```console
yq '.services.web.image' compose.yaml
```

書き換え。
`-i`で入力ファイルを直接書き換えます。
コメントは保持されます。

```console
yq -i '.version = "2"' compose.yaml
```

出力形式の変換は`-o`で指定します。

```console
yq -o=json '.' compose.yaml
```

入力形式は既定では`auto`で、
ファイルの拡張子から判別されます。
拡張子のない標準入力を渡す時だけ`-p`で明示してください。
`auto`, `yaml`, `kyaml`, `json`, `props`, `csv`, `tsv`, `xml`, `base64`, `uri`, `toml`, `hcl`, `lua`, `ini`をサポートします。

```console
curl -fsSL "$url" | yq -p=xml '.root.item'
```

シェルの値はフィルタへ文字列連結せずに、
環境変数を経由して渡します。
jqの`--arg`に相当します。

```console
version=2 yq -i '.version = strenv(version)' compose.yaml
```

複数のファイルやドキュメントを横断して処理する時は`eval-all`を使います。

```console
yq eval-all '. as $item ireduce ({}; . * $item)' base.yaml override.yaml
```

## jqとの違いで戸惑いやすい点

- 出力形式も既定では`auto`で、入力に合わせた形式になります。JSONが欲しい時は`-o=json`を付けます。
- スカラーの展開は出力形式によって変わります。YAML出力では既定でクォートなしに展開されますが、`-o=json`では`"a"`のようにクォートが付きます。生の値が欲しい時は`--unwrapScalar`の短縮形である`-r`を明示してください。
- 環境変数は`--arg`ではなく`env(NAME)`と`strenv(NAME)`で参照します。

## ファイルの書き換え

リポジトリ内の設定ファイルを人間が読む前提で書き換える時は、
`Edit`ツールを優先してください。
差分が読みやすいためです。

`yq -i`は多数のファイルへ同じ変更を機械的に適用する場合などに使ってください。

## 例外

以下の場合はPythonなどを使って構いません。

- HTTP通信やファイルシステムの操作など、データの変換以外の副作用が処理の本体である場合。
- スキーマ検証やテンプレート展開など、yqの機能では表現が極端に複雑になる場合。
- 既存のPythonプロジェクトの一部としてコードを書く場合。
- 実行環境にyqが入っていない場合。

例外に当たる場合でも、
値を取り出す部分だけをyqへ切り出せるなら切り出してください。
