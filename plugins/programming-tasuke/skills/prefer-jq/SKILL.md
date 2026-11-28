---
name: prefer-jq
description: Prefer jq over Python or other general-purpose scripting languages for reading, filtering, or transforming JSON. Use when extracting values from JSON, parsing an API response, or writing anything that would otherwise reach for Python's json module or a `node -e` one-liner.
user-invocable: false
---

# JSONの処理にはjqを優先する

JSONを読み取る、絞り込む、変換するだけの用事には`jq`を使ってください。
Pythonなどの汎用スクリプト言語は持ち出しません。
`node -e`や`ruby -e`や`perl -e`のような、Python以外の汎用言語のワンライナーも同じです。

```console
# 避ける
python3 -c 'import json,sys; d=json.load(sys.stdin); print("\n".join(x["name"] for x in d["items"] if x["active"]))'
# 使う
jq -r '.items[] | select(.active) | .name'
```

汎用スクリプト言語は何でも出来てしまうので、
コマンドの実行を承認する人間は、毎回スクリプトの中身を読んで安全性を判断することになります。
`Bash(python:*)`のような包括的な許可を出すのも危険です。
jqに出来ることはデータの変換にほぼ限られていて副作用が少ないので、
包括的な許可を出しやすく、承認の手間が発生しません。

汎用スクリプト言語のワンライナーは、シェルのクォートとスクリプト側のクォートが干渉して壊れやすく、
リトライを繰り返す原因にもなります。
JSONを取り出したり整形したりするだけなら、jqの方が短く書けて読みやすいという利点もあります。

## オプション

シェルの値は`--arg name value`か`--argjson name json`でフィルタへ渡します。
フィルタの文字列へ連結してJSONを組み立てると、クォートやエスケープが壊れるためです。

```console
# 避ける
jq ".name = \"$name\"" data.json
# 使う
jq --arg name "$name" '.name = $name' data.json
```

条件判定には`-e`が使えます。
終了ステータスは、最後の出力が`false`か`null`なら1に、出力が一つも無ければ4になります。

## ファイルの書き換え

リポジトリ内のファイルを書き換えるときは`Edit`ツールを優先してください。
差分が読みやすく、意図しない整形の変化も起きないためです。

jqは読み取りと抽出とパイプでの加工に使います。
jqは入力ファイルを直接書き換えないので、別のファイルへ書き出してから置き換える必要があります。
その手間に見合うのは、機械が生成した巨大なJSONを一括変換するような場合だけです。

## 例外

以下の場合はPythonなどを使って構いません。
その場合でも、JSONを抽出する部分だけをjqへ切り出せるなら切り出してください。

- HTTP通信やファイルシステムの操作など、JSONの変換以外の副作用が処理の本体である場合。
- 統計処理や複雑な日時計算など、jqの標準機能では表現が極端に複雑になる場合。
- 既存のPythonプロジェクトの一部としてコードを書く場合。
- 実行環境にjqが入っていない場合。

YAMLやXMLやTOMLやCSVについては`programming-tasuke:prefer-yq`スキルを参照してください。
