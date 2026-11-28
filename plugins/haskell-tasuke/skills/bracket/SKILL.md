---
name: bracket
description: Use bracket or with-style functions to guarantee resource cleanup even on exceptions instead of separate do blocks. Use when writing or reviewing Haskell code that acquires and releases resources.
user-invocable: false
---

# bracketによるリソース管理

リソースの獲得と解放は、`bracket`で書ける場合は`bracket`で書いてください。
`bracket`なら、途中で例外が発生しても解放が確実に実行されます。
獲得と解放を`do`ブロックの中にばらばらに並べる書き方は避けます。

ライブラリには、`bracket`を特定のリソース向けに特化させたwith形式の関数がしばしばあります。
例えば以下のような関数です。
そのような関数がある場合は、`bracket`を直接使うよりもそちらを優先します。

```haskell
withAsync :: MonadUnliftIO m => m a -> (Async a -> m b) -> m b
```
