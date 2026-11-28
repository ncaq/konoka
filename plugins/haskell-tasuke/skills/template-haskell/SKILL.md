---
name: template-haskell
description: Distinguish mkName and newName in Template Haskell. Use mkName to capture existing names and newName for fresh non-colliding names. Use when writing or reviewing Template Haskell code that generates names.
user-invocable: false
---

# Template Haskellの`mkName`と`newName`の使い分け

[template-haskell](https://hackage.haskell.org/package/template-haskell)で名前を作るときは、
既にスコープにある名前をキャプチャして参照する必要がある場合だけ`mkName`を使います。
それ以外の場合は、衝突しない新しい名前を生成する安全な`newName`を使います。
