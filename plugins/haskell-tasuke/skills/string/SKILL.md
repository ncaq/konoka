---
name: string
description: Prefer Text over String for text data, and use ByteString for binary or non-Unicode data. Use when writing or reviewing Haskell code that handles strings, text, or byte data.
user-invocable: false
---

# 文字列型の使い分け

文字列にはなるべく`String`ではなく`Text`を使ってください。
`String`は`[Char]`のエイリアスなので非常に非効率的です。
さらに`show`で表示すると、日本語などのマルチバイト文字がエスケープされます。
古くからある型なのでライブラリに蔓延しているだけです。

- `Text`: Unicodeで正しく表現できる文字列に使います。
  基本的には`Text.Lazy`ではなくStrictな`Text`を優先します。
- `ByteString`: バイナリデータ、エンコードが不明なデータ、
  非Unicodeでやり取りされるネットワーク上の文字列データなどに使います。
- `String`: ライブラリのAPIが`String`を使っているときだけ使います。
  そのデータを長く使う場合は`Text`に変換します。

詳しく知りたい場合は、
[Haskellの文字列型: 分類と特徴 - Qiita](https://qiita.com/mod_poppo/items/740659702f31216fdade)
を参照してください。
