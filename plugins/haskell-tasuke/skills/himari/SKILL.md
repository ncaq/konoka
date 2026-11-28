---
name: himari
description: himari is ncaq's rio-like custom Haskell Prelude. Import it with a single `import Himari`, never `import Himari.Prelude` or other submodules directly. Use when writing or reviewing Haskell code in a project that depends on the himari package.
user-invocable: false
---

# himari

[himari](https://github.com/ncaq/himari)は、
[rio](https://hackage.haskell.org/package/rio)の思想を受け継ぎつつ改良した、
ncaqによるカスタムPreludeライブラリです。
Hackageでは<https://hackage.haskell.org/package/himari>にあります。

himariに依存するプロジェクトでは`NoImplicitPrelude`が有効になっていて、
標準のPreludeの代わりにhimariを使います。

## importは`import Himari`の1行にする

himariを使うモジュールでは、himariを以下の1行だけでimportします。

```haskell
import Himari
```

`Himari`モジュールは、
`Himari.Char`、`Himari.Env`、`Himari.Env.Simple`、`Himari.Logger`、`Himari.Prelude`を
全て再exportする入口です。

`Himari.Prelude`は`Himari`から再exportされるための内部モジュールなので、直接importしません。
`import Himari.Prelude`と書くと、`Himari.Char`や`Himari.Env`や`Himari.Logger`などが漏れて、
使えるはずのシンボルが見つからなくなります。
`Himari.SafePrelude`や`Himari.Prelude.Type`などの他のサブモジュールも、
全て`import Himari`で揃うので、基本的には直接importしません。

サブモジュールを直接importする例外は、`Safe`言語拡張を使うモジュールです。
そのモジュールでは`Himari.SafePrelude`だけをimportすることがあります。
`hiding`したシンボルの一部を名前を変えて使いたい場合も考えられますが、
その場合はqualified importを使うので、サブモジュールを直接importすることは稀です。

## `import Himari`で使えるもの

以下は`import Himari`だけで使えるので、個別にimportしません。

- [ReaderT IO](https://academy.fpblock.com/blog/2017/06/readert-design-pattern/)パターンを支援するモナドと関数。
  例えば以下です。
  - `newtype Himari env a = Himari { unHimari :: ReaderT env IO a }`
  - `runHimari :: (MonadIO m) => env -> Himari env a -> m a`
- 文字列とコンテナの型。
  例えば`ByteString`、`HashMap`、`Map`、`NonEmpty`、`Seq`、`Set`、`Text`、`Vector`です。
- IOと並行処理のための`UnliftIO`系のモジュール。
  例えば`UnliftIO.Async`、`UnliftIO.Directory`、`UnliftIO.Exception`です。
- ログの関数。
  ロガーライブラリの再exportによって`logInfo`などが使えます。
- Aeson。
  `Data.Aeson`系と`Deriving.Aeson`です。

個別のモジュールに属していて、そのままimportすると名前が衝突しやすい関数が必要なときは、
qualified importを使います。
別名はhimariのhlintルールに由来する規約に従います。
以下はその一部です。

```haskell
import Data.ByteString qualified as B
import Data.List qualified as L
import Data.Map.Strict qualified as Map
import Data.Text qualified as T
```

## 関連するhaskell-tasukeスキル

himariを使うときにも、以下のhaskell-tasukeスキルの方針が当てはまります。

- [haskell-tasuke:io-monad](../io-monad/SKILL.md):
  `MonadIO`や`MonadUnliftIO`を優先します。
- [haskell-tasuke:lens](../lens/SKILL.md):
  `makeFieldsId`でレコードのlensを生成します。
  `HasLogAction`などもこれで提供します。
- [haskell-tasuke:partial-function](../partial-function/SKILL.md):
  部分関数を使いません。
  himariのhlintルールが検出を補助します。
- [haskell-tasuke:string](../string/SKILL.md):
  `Text`を優先し、バイナリには`ByteString`を使います。
