---
name: himari
description: himari is ncaq's rio-like custom Haskell Prelude. Import it with a single `import Himari`, never `import Himari.Prelude` or other submodules directly. Use when writing or reviewing Haskell code in a project that depends on the himari package.
user-invocable: false
---

# himari

[himari](https://github.com/ncaq/himari)は、
ncaqが作成した、
[rio](https://hackage.haskell.org/package/rio)
の思想を受け継ぎつつ改良したカスタムPreludeライブラリです。

- リポジトリ: <https://github.com/ncaq/himari>
- Hackage: <https://hackage.haskell.org/package/himari>

himariに依存するプロジェクトでは、
`NoImplicitPrelude`が有効になっており、
標準のPreludeの代わりにhimariを使います。

## import は `import Himari` の1行だけ

himariを使うモジュールでは、
原則として以下の1行だけをimportします。

```haskell
import Himari
```

`Himari`モジュールが以下を全て再exportするエントリポイントだからです。

- `Himari.Char`
- `Himari.Env`
- `Himari.Env.Simple`
- `Himari.Logger`
- `Himari.Prelude`

## `import Himari.Prelude` を直接書かない

`Himari.Prelude`などのサブモジュールを直接importするのは間違いです。

```haskell
-- 間違い: サブモジュールを直接importしている
import Himari.Prelude
```

これをやると`Himari.Char`や`Himari.Env`や`Himari.Logger`などが漏れてしまい、
本来使えるはずのシンボルが見つからなくなります。

`Himari.Prelude`は`Himari`から再exportされるための内部モジュールであり、
利用側が直接importするものではありません。

同様に`Himari.SafePrelude`や`Himari.Prelude.Type`なども基本は直接importしません。
全て`import Himari`で揃います。

例外としては`Safe`言語拡張を使うモジュールで`Himari.SafePrelude`のみをimportするケースがあります。

また`hiding`したけど一部だけrenameしてシンボルを利用したいこともあるかもしれませんが、
これはqualified importの方を使うので稀でしょう。

## 主なシンボルの出どころ

`import Himari`で以下が利用可能になります。
個別importは不要です。

- [ReaderT IO](https://academy.fpblock.com/blog/2017/06/readert-design-pattern/)パターンの、
  支援モナドと例えば以下の関数:
  - `newtype Himari env a = Himari { unHimari :: ReaderT env IO a }`
  - `runHimari :: (MonadIO m) => env -> Himari env a -> m a`
- 文字列・コンテナ型、例えば以下:
  - `ByteString`
  - `HashMap`
  - `Map`
  - `NonEmpty`
  - `Seq`
  - `Set`
  - `Text`
  - `Vector`
- IO・並行: `UnliftIO`系、例えば以下:
  - `UnliftIO.Async`
  - `UnliftIO.Directory`
  - `UnliftIO.Exception`
- ログ: ロガーライブラリのre-exportで提供される`logInfo`など
- Aeson: `Data.Aeson`系と`Deriving.Aeson`

個別のモジュールのそのままimportしたら名前がコンフリクトする関数が必要になった場合は
qualified importが必要になります。
その時のエイリアス規約の一部(himariのhlintルール由来)は以下の通りです。

- `Data.ByteString` → `qualified as B`
- `Data.Text` → `qualified as T`
- `Data.Map.Strict` → `qualified as Map`
- `Data.List` → `qualified as L`

## 関連するhaskell-tasukeスキル

himari利用時も以下のhaskell-tasukeスキルの方針が当てはまります。

- [haskell-tasuke:io-monad](../io-monad/SKILL.md):
  `MonadIO`や`MonadUnliftIO`を優先する
- [haskell-tasuke:lens](../lens/SKILL.md):
  `makeFieldsId`でレコードのLensを生成し`HasLogAction`などを提供する
- [haskell-tasuke:partial-function](../partial-function/SKILL.md):
  部分関数を禁止する、himariのhlintルールが補助する
- [haskell-tasuke:string](../string/SKILL.md):
  `Text`を優先し、バイナリは`ByteString`を使う
