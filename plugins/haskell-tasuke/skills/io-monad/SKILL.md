---
name: io-monad
description: Prefer MonadIO and MonadUnliftIO type classes over using IO directly, and avoid redundant liftIO. Use when writing or reviewing Haskell IO actions, monad transformers, or type class abstractions.
user-invocable: false
---

# IOモナドの扱い

## `IO`を直接使わず型クラスで抽象化する

アクションを定義するときは、できる限り`IO`を直接使わず、
[`MonadIO`](https://hackage-content.haskell.org/package/base/docs/Control-Monad-IO-Class.html)や、
[`MonadUnliftIO`](https://hackage.haskell.org/package/unliftio-core/docs/Control-Monad-IO-Unlift.html)といった、
型クラスで抽象化します。
`IO`はプリミティブすぎて、モナド変換子などと一緒に扱うのが不便で、
呼び出すたびに`liftIO`が要るためです。

より一般的な`MonadIO`で定義できないかを先に検討し、
`MonadUnliftIO`が要求される場合は`MonadUnliftIO`で定義します。
`MonadUnliftIO`は`MonadIO`をスーパークラスに持つので、
`MonadIO`で定義した関数は`MonadUnliftIO`の文脈からそのまま呼べます。

## `IO`の文脈で`MonadUnliftIO`のアクションを実行する

`MonadIO`や`MonadUnliftIO`の文脈で`IO`のアクションを実行するには、
`liftIO`を使うだけで済みます。

逆に、`IO`を要求するライブラリの型に`MonadUnliftIO`のアクションを渡すときは、
以下の関数を使います。

```haskell
askRunInIO :: MonadUnliftIO m => m (m a -> IO a)
toIO :: MonadUnliftIO m => m a -> m (IO a)
```

`askRunInIO`を`MonadUnliftIO`の文脈で呼ぶと、
`MonadUnliftIO`のアクションを`IO`に変換する関数が得られます。
これを`runInIO`などの名前で束縛し、渡すアクションを`runInIO`で包みます。
単発で済むなら`toIO`でも構いません。

## 冗長な`liftIO`を書かない

既に`MonadIO m => m a`のような型を持つ関数は、
`liftIO`に渡さずにそのまま呼び出します。
`liftIO`に渡しても動きますが、無意味に冗長で読みにくくなるためです。
