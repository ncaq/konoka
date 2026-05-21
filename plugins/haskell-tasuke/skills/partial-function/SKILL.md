---
name: partial-function
description: Avoid partial functions such as head, fromJust, read, and (!!) in Haskell. Prefer total functions, Maybe-returning variants, and other safe alternatives. Use when writing or reviewing Haskell code that accesses lists, parses strings, or handles Maybe.
user-invocable: false
---

# 部分関数の禁止

純粋関数であるにもかかわらず、
特定の入力に対して例外を投げる部分関数の使用は禁止します。

部分関数は型の上ではすべての入力を受け付けるように見えますが、
実際には一部の入力でしか正しく動作しません。
そのため型検査を通過しても実行時にクラッシュする原因になります。

純粋関数空間では安全な方法では例外を捕捉することが出来ないため、
エラーの処理が困難になります。

遅延評価と組み合わせると、
例外が発生するタイミングが予測できなくなり、
例外を捕捉しているはずなのに別の場所で評価された時に例外が発生することもあります。

全域関数や、
失敗を`Maybe`や`Either`などで返す関数に置き換えてください。

## 代表的な部分関数と代替

### fromJust

`Maybe`の中身を取り出しますが、
`Nothing`に対しては例外を投げます。

`fromMaybe`でデフォルト値を与えるか、
`maybe`やパターンマッチで`Nothing`の場合を明示的に処理してください。

### read

文字列をパースしますが、
失敗すると例外を投げます。

`readMaybe`や、
導入されていれば`readMay`を使い、
失敗を`Maybe`として受け取ってください。

### head / tail / init / last

空リストに対して例外を投げます。

先頭要素が欲しいだけなら`listToMaybe`やパターンマッチを使ってください。

導入されていれば`headMay`などの`Maybe`を返すバージョンを使ってください。

空でないことが事前条件であるなら、
`NonEmpty`で型として表現すれば、
`NonEmpty.head`は全域関数になります。

### (!!)

範囲外のインデックスに対して例外を投げます。

`Data.List.(!?)`のように、
`Maybe`を返す添字アクセスを使ってください。

そもそもリストの添字アクセスはパフォーマンスが悪いので、
可能な限り走査するようなコードを書いてください。

### maximum / minimum / foldr1 / foldl1

空のコンテナに対して例外を投げます。

`NonEmpty`版を使うか、
初期値を与える安全なバージョンを使ってください。
