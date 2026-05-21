---
name: convertible
description: Prefer the convert function from the convertible library over individual conversion functions like pack, unpack, decodeUtf8, and encodeUtf8. Use when writing or reviewing Haskell code that converts between types.
user-invocable: false
---

# [convertible: Typeclasses and instances for converting between types](https://hackage.haskell.org/package/convertible)

導入しているプロジェクトでは、
`convert`関数で汎用的な型変換を行えます。

- `decodeUtf8`
- `encodeUtf8`
- `pack`
- `unpack`

のような個別の関数よりなるべく`convert`を使うようにしてください。

これらの関数は名前から型変換をしているというだけの意味しか読み取れなくて、
実際に何をやっているかはどうでもいいノイズだからです。

`convert`に統一されると思考のノイズが減ります。
