---
name: io-monad
description: Prefer MonadIO and MonadUnliftIO type classes over using IO directly, and avoid redundant liftIO. Use when writing or reviewing Haskell IO actions, monad transformers, or type class abstractions.
user-invocable: false
---

# IOモナドの扱い

## `IO`をなるべく直接使わず型クラスを使う

`IO`モナドはプリミティブすぎます。

他のモナド変換子などと一緒に取り扱うのが不便です。

呼び出すたびに`liftIO`を使うのは面倒です。

なのでアクションを定義するときは出来る限り`IO`を直接使うのではなく、
[`MonadIO`](https://hackage-content.haskell.org/package/base/docs/Control-Monad-IO-Class.html)や、
[`MonadUnliftIO`](https://hackage.haskell.org/package/unliftio-core/docs/Control-Monad-IO-Unlift.html)といった、
型クラスで抽象化するべきです。

`MonadIO`の方がより一般的なので、
先にそちらで定義出来ないか検討するべきです。

`MonadUnliftIO`の定義では、

```haskell
class MonadIO m => MonadUnliftIO (m :: Type -> Type)
```

となっているため、
`MonadUnliftIO`のインスタンスは必ず`MonadIO`のインスタンスも持ちます。
なので`MonadUnliftIO`の中で`MonadIO`の関数を呼び出すことはできるので、
`MonadIO`にすることに問題はありません。

`MonadUnliftIO`が要求される場合はそちらで定義してください。

## `IO`内部で`MonadUnliftIO`のアクションを実行する

`MonadIO`や`MonadUnliftIO`の文脈で`IO`のアクションを実行する場合は`liftIO`を使うだけで良いです。

`IO`の文脈で`MonadUnliftIO`のアクションを実行する場合はひと工夫必要な時があります。

以下の関数を使うことで解決できます。

```haskell
askRunInIO :: MonadUnliftIO m => m (m a -> IO a)
```

`askRunInIO`を`MonadUnliftIO`の文脈で呼び出すことで、
`MonadUnliftIO`のアクションを`IO`に変換する関数を取得できます。

この関数を`runInIO`関数などの名前で束縛して、
`IO`を要求するライブラリの型に対して、
`MonadUnliftIO`のアクションを`runInIO`で包んで渡すことが出来ます。

または単発で済むならば以下の関数を使っても良いでしょう。

```haskell
toIO :: MonadUnliftIO m => m a -> m (IO a)
```

## 無駄な`liftIO`の禁止

既に`MonadIO m => m a`のような型を持っている関数を、
`liftIO`に渡しても問題なく動きますが、
無意味に冗長で読みにくいので、
`liftIO`なしでそのまま呼び出してください。
