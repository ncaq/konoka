---
name: warning
description: Do not disable GHC or hlint warnings. Suppress them only per module with OPTIONS_GHC or annotations for justified exceptions. Use when writing or reviewing Haskell code, cabal files, or hlint configuration that disables warnings.
user-invocable: false
---

# 警告を無効にしない

GHCと[hlint](https://github.com/ndmitchell/hlint)の警告は、
正当な理由がある場合を除いて無効にしません。

正当な理由があって無効にするときは、該当する警告だけを、
モジュール単位のアノテーションコメントで無効にします。
cabalなどのプロジェクトファイルやhlintのルールファイルには、
警告を無効にする設定を書きません。
そのモジュールのコードが多い場合は、無効にする範囲を狭めるために、
警告と干渉するコードを別のモジュールに切り出すことも検討してください。

## GHCの警告

正当な理由に当たるのは、以下のような場合です。

孤立インスタンスを定義するモジュールでは、以下のように無効にして構いません。
ただし孤立インスタンスの定義自体をなるべく避けるべきなので、
設計上どうしても仕方がないときだけにします。

```haskell
{-# OPTIONS_GHC -Wno-orphans #-}
```

Template Haskellによるコード生成で、
こちらから制御できない変数名のshadowingや未使用の束縛が発生するモジュールでは、
以下のうち発生する警告を無効にして構いません。

```haskell
{-# OPTIONS_GHC -Wno-name-shadowing #-}
{-# OPTIONS_GHC -Wno-unused-binds #-}
```

## hlintの警告

正当な理由に当たるのは、以下のような場合です。

- ライブラリのAPIがhlintの警告とどうしても干渉するなど、その書き方でしか書けない場合。
- hlintのバグである場合。
  hlintのissueやPRを確認して、バグであると判断できた場合です。
  まだ報告されていなくても、最小限の再現コードで確認して、
  挙動が明らかにおかしいと判断できれば無効にして構いません。
