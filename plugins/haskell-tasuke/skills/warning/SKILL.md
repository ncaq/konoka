---
name: warning
description: Do not disable GHC or hlint warnings. Suppress them only per module with OPTIONS_GHC or annotations for justified exceptions. Use when writing or reviewing Haskell code, cabal files, or hlint configuration that disables warnings.
user-invocable: false
---

# 警告を無効にしない

## GHCの警告は無効にしない

GHCの警告を無効にすることは原則禁止します。

### 例外

正当な理由がある場合は、
特定の警告を無効にすることを許可します。

cabalなどのプロジェクトファイルを編集するのではなく、
モジュール単位でアノテーションコメントを書いて無効化してください。

そのモジュールのコードが多い場合は、
警告と干渉するコードを別モジュールに切り出すことも検討してください。

#### 孤立インスタンス

孤立インスタンスを定義する場合は許可します。

以下のように無効化してください。

```haskell
{-# OPTIONS_GHC -Wno-orphans #-}
```

ただし孤立インスタンスの定義自体をなるべく避けるべきなので、
設計上どうしても仕方がないときだけにしてください。

#### Template Haskellで避けられない警告

Template Haskellを利用したコード生成で、
こちらから制御できない変数名のshadowingや、
未使用の束縛が発生する場合も、
無効にすることを許可します。

以下のように無効化してください。

```haskell
{-# OPTIONS_GHC -Wno-shadowed-variables #-}
{-# OPTIONS_GHC -Wno-unused-binds #-}
```

## hlintの警告は無効にしない

[hlint](https://github.com/ndmitchell/hlint)の警告を無効にすることは原則禁止します。

### 例外

正当な理由がある場合は、
特定の警告を無効にすることを許可します。

hlintのルールファイルを編集するのではなく、
モジュール単位でアノテーションコメントを書いて無効化してください。

そのモジュールのコードが多い場合は、
警告と干渉するコードを別モジュールに切り出すことも検討してください。

#### その方法でしか書けない場合

ライブラリのAPIがhlintの警告とどうしても干渉してしまう場合などは、
無効にすることを許可します。

#### hlintのバグ

hlintのissueやPRを確認して、
バグであると判断した場合は無効にしても構いません。

まだ報告されていない場合も、
最小限の再現コードで確認して、
明らかに挙動がおかしいと判断した場合は無効にしても構いません。
