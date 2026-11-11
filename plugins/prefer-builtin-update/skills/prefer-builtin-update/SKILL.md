---
name: prefer-builtin-update
description: Use the builtin Edit tool (or Write for full rewrites) instead of sed, awk, perl, or Python one-liners when modifying files, and do not run sed or awk at all. Use when editing, replacing, or rewriting file contents, or when about to run sed or awk.
user-invocable: false
---

# ファイル更新には組み込みのEditツールを使う

ファイルの内容を書き換える用事に、
sedやawkやperlやPythonなどのプログラムを持ち出さないでください。
組み込みの`Edit`ツールを使ってください。
ファイルの新規作成や全体の書き直しには`Write`ツールを使ってください。

in-place編集のフラグを使わずに、
`grep -v`などの出力を一時ファイルへリダイレクトしてから`cp`や`mv`で書き戻すのも同じです。

## sedとawkは使わない

sedとawkは書き換えに限らず、
用途を問わず使わないでください。
ファイルの一部を表示する場合は、
`sed -n`ではなく`Read`ツールの`offset`と`limit`を使ってください。
コマンドの出力を加工する場合は、
grepやcutやtrなどを使ってください。

## 理由

`Edit`ツールは変更箇所が差分として表示されるため、
承認する人間が実行前に何が変わるのかを正確に確認できます。
プログラムによる置換は実行するまで結果が分からず、
毎回スクリプトの中身を読んで安全性を判断する負担が発生します。
実行後の差分も読みにくくなります。

`Edit`ツールは対象文字列が一意に定まらなければ失敗するため、
意図しない箇所を巻き込む事故が起きにくいです。
sedの正規表現による置換は想定外の行にもマッチして、
気付かないうちにファイルを壊すことがあります。

汎用スクリプト言語のワンライナーは、
シェルのクォートとスクリプト側のクォートが干渉して壊れやすく、
リトライを繰り返す原因にもなります。

## 対比

避ける:

```console
sed -i 's/foo/bar/' src/main.rs
awk '/^foo$/ { print "bar"; next } { print }' src/main.rs > /tmp/main.rs && cp /tmp/main.rs src/main.rs
grep -v '^use foo;$' src/main.rs > /tmp/main.rs && cp /tmp/main.rs src/main.rs
perl -i -pe 's/foo/bar/' README.md
python3 -c "content = open('config.json').read().replace('foo', 'bar'); open('config.json', 'w').write(content)"
```

使う:
`Edit`ツールで書き換え前後の文字列を指定して置き換えます。
複数箇所を書き換える場合も、
`Edit`ツールを箇所ごとに呼び出してください。

## 例外

ものすごい量の機械的な置換で、
`Edit`ツールでは呼び出し回数が現実的でない場合に限り、
プログラムによる置換を使って構いません。

その場合もワンライナーは使わず、
`Write`ツールで置換処理をスクリプトファイルとして書き出してから実行してください。
ファイルとして残すことで人間が実行前に内容を検証できます。
`sed -f`や`awk -f`で実行するプログラムファイルではなく、
bashやPythonなどで実行するスクリプトファイルに、
ファイルへの書き込みまで含めてください。
実行前に対象ファイルの範囲と置換内容を説明し、
実行後は`git diff`などで結果の差分を確認してください。

## hookによる補助

このプラグインのPreToolUseフックが、
Bashツール経由のsedとawkの使用や、
in-place編集やワンライナーによるファイル書き込みや、
grepの出力のファイルへの書き込みを検出して拒否します。
リトライ往復を削減するための補助動作なので、
依存しないでください。
フックは全ての書き換えパターンを検出できません。
なので最初から`Edit`ツールを使ってください。
