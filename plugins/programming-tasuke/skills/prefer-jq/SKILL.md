---
name: prefer-jq
description: Prefer jq over Python or other general-purpose scripting languages for reading, filtering, or transforming JSON. Use when extracting values from JSON, parsing an API response, or writing anything that would otherwise reach for Python's json module or a `node -e` one-liner.
user-invocable: false
---

# JSONの処理にはjqを優先する

JSONを読み取ったり、
絞り込んだり、
変換したりするだけの用事に、
Pythonなどの汎用スクリプト言語を持ち出さないでください。
`jq`を使ってください。

## 理由

汎用スクリプト言語は何でも出来てしまいます。
コマンドの実行を承認する人間は毎回スクリプトの中身を読んで安全性を判断しなければならず、
`Bash(python:*)`のような包括的な許可を出すことも危険です。
jqの出来ることはデータの変換にほぼ限られていて副作用が少ないため、
包括的な許可を出しやすく、
承認の手間が発生しません。

単にJSONを取り出したり整形したりするだけなら、
jqの方が短く書けて読みやすいという利点もあります。

汎用スクリプト言語のワンライナーは、
シェルのクォートとスクリプト側のクォートが干渉して壊れやすく、
リトライを繰り返す原因にもなります。

## 対比

値の取り出し。

```console
# 避ける
python3 -c 'import json,sys; print(json.load(sys.stdin)["items"][0]["name"])'
# 使う
jq -r '.items[0].name'
```

絞り込み。

```console
# 避ける
python3 -c 'import json,sys; d=json.load(sys.stdin); print("\n".join(x["name"] for x in d["items"] if x["active"]))'
# 使う
jq -r '.items[] | select(.active) | .name'
```

集計。

```console
# 避ける
python3 -c 'import json,sys; print(sum(x["size"] for x in json.load(sys.stdin)["items"]))'
# 使う
jq '[.items[].size] | add'
```

Pythonに限った話ではありません。
`node -e`や`ruby -e`や`perl -e`のような他の汎用言語のワンライナーも同様に避けてください。

## よく使うオプション

- `-r`: 文字列をクォートなしの生の値として出力します。シェル変数へ代入する時に使います。
- `-e`: 結果が`false`か`null`の時に終了ステータスを非0にします。条件判定に使えます。
- `-n`: 入力を読まずにJSONを組み立てます。
- `-s`: 複数の入力をひとつの配列にまとめます。
- `--arg name value`と`--argjson name json`: シェルの値をフィルタへ安全に渡します。

シェルの値をフィルタの文字列へ連結してJSONを組み立てるのは避けてください。
クォートやエスケープが壊れます。

```console
# 避ける
jq ".name = \"$name\"" data.json
# 使う
jq --arg name "$name" '.name = $name' data.json
```

## ファイルの書き換え

リポジトリ内のファイルを書き換える時は`Edit`ツールを優先してください。
差分が読みやすく、
意図しない整形の変化も起きません。

jqは読み取りと抽出とパイプでの加工に使ってください。
jqは入力ファイルを直接書き換えないため、
別のファイルへ書き出してから置き換える必要があり、
その手間に見合うのは機械が生成した巨大なJSONを一括変換するような場合だけです。

## 例外

以下の場合はPythonなどを使って構いません。

- HTTP通信やファイルシステムの操作など、JSONの変換以外の副作用が処理の本体である場合。
- 統計処理や複雑な日時計算など、jqの標準機能では表現が極端に複雑になる場合。
- 既存のPythonプロジェクトの一部としてコードを書く場合。
- 実行環境にjqが入っていない場合。

例外に当たる場合でも、
JSONを抽出する部分だけをjqへ切り出せるなら切り出してください。

YAMLやXMLやTOMLについては`programming-tasuke:prefer-yq`スキルを参照してください。
