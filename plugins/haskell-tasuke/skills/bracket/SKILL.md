---
name: bracket
description: Use bracket or with-style functions to guarantee resource cleanup even on exceptions instead of separate do blocks. Use when writing or reviewing Haskell code that acquires and releases resources.
user-invocable: false
---

# bracketによるリソース管理

## bracketで書ける時はそれを使う

`bracket`を使うと、
例外が発生した場合でもリソースの解放を確実に行えます。

`bracket`でリソースの解放処理が書ける時はそちらを使ってください。

わざわざバラバラの`do`ブロックで書かないでください。

## 出来る限りwithパターンの関数を使う

ライブラリには`bracket`関数の特化型である関数がしばしば存在します。

例えば、

```haskell
withAsync :: MonadUnliftIO m => m a -> (Async a -> m b) -> m b
```

などの関数です。

存在するならばそれを優先します。
