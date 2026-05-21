---
name: string
description: Prefer Text over String for text data, and use ByteString for binary or non-Unicode data. Use when writing or reviewing Haskell code that handles strings, text, or byte data.
user-invocable: false
---

# 文字列型の使い分け

`String`は`[Char]`のエイリアスであり、
文字列を表現するために使われますが、
非常に非効率的です。

さらに`show`で表示したときに日本語を含むマルチバイト文字列がエスケープされます。

昔からある型のため仕方なく使われていますが、
なるべく`Text`を使ってください。

`Text`はUnicode文字列を効率的に扱える型です。
基本的には`Text.Lazy`ではなくStrictな`Text`を優先して使ってください。

`ByteString`との使い分けは、
Unicodeで正しく表現できる文字列の場合は`Text`を使い、
バイナリデータやエンコードが不明なデータ、
非Unicodeでやり取りされるネットワーク上の文字列データなどは`ByteString`を使います。

`String`は古くから使われているためライブラリに蔓延しているだけです。
ライブラリが関係するときだけ使い、
そのデータを長く使う場合は`Text`に変換するべきです。

詳しく知りたい場合は、
[Haskellの文字列型: 分類と特徴 - Qiita](https://qiita.com/mod_poppo/items/740659702f31216fdade)
を参照してください。
