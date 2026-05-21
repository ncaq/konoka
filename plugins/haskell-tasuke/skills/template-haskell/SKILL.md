---
name: template-haskell
description: Distinguish mkName and newName in Template Haskell. Use mkName to capture existing names and newName for fresh non-colliding names. Use when writing or reviewing Template Haskell code that generates names.
user-invocable: false
---

# [template-haskell: Support library for Template Haskell](https://hackage.haskell.org/package/template-haskell)

## Template Haskellの`mkName`と`newName`の使いかた

既にスコープに存在する名前をキャプチャする形で参照したい時は`mkName`を使います。

新しいフレッシュな衝突しない名前を生成したい時は`newName`を使います。

キャプチャする必要がある場合は`mkName`、
そうでなければ安全な`newName`を使うべきです。
