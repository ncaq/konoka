---
name: partial-function
description: Avoid partial functions such as head, fromJust, read, and (!!) in Haskell. Prefer total functions, Maybe-returning variants, and other safe alternatives. Use when writing or reviewing Haskell code that accesses lists, parses strings, or handles Maybe.
user-invocable: false
---

# 部分関数の禁止

`head`や`fromJust`のように、
純粋関数でありながら特定の入力に対して例外を投げる部分関数は使いません。
全域関数か、失敗を`Maybe`や`Either`などで返す関数に置き換えます。

部分関数は型の上では全ての入力を受け付けるように見えるので、
型検査を通っても実行時にクラッシュします。
純粋なコードの中では安全な方法で例外を捕捉できないので、エラーの処理が難しくなります。
遅延評価と組み合わさると例外が発生するタイミングも予測できず、
捕捉しているはずの場所ではなく、別の場所で評価されたときに例外が発生することもあります。

## 代表的な部分関数と代替

- `fromJust`: `fromMaybe`でデフォルト値を与えるか、
  `maybe`やパターンマッチで`Nothing`の場合を明示的に処理します。
- `read`: `readMaybe`か、導入されていれば`readMay`を使い、失敗を`Maybe`として受け取ります。
- `head`, `tail`, `init`, `last`: 先頭の要素が欲しいだけなら`listToMaybe`やパターンマッチを使います。
  導入されていれば`headMay`などの`Maybe`を返す版を使います。
  空でないことが事前条件なら`NonEmpty`で型として表現します。
  `NonEmpty.head`は全域関数です。
- `(!!)`: `Data.List.(!?)`のような`Maybe`を返す添字アクセスを使います。
  そもそもリストの添字アクセスは性能が悪いので、可能な限り走査するコードにします。
- `maximum`, `minimum`, `foldr1`, `foldl1`: `NonEmpty`版か、初期値を与える安全な版を使います。
