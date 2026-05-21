---
name: cabal-command
description: Use cabal with --disable-optimization for development builds and tests, and add --enable-tests to avoid rebuilds. Use when running or suggesting cabal build or test commands in Haskell development.
user-invocable: false
---

# cabalコマンド

## 最適化の無効化

開発時のビルド確認やテストの実行時には、
`--disable-optimization`オプションを付与して最適化を無効化します。

Haskellは結構ビルドに時間がかかる言語なので、
最適化時の挙動を確認するわけでも、
リリースするわけでもないときは、
最適化を無効化してビルド時間を短縮してください。

## ビルド

ビルドは以下のコマンドを実行します。

```console
cabal build --disable-optimization --enable-tests
```

`build`サブコマンドの実行時にはテストは実行されずにビルドだけ行われます。
テストを行う時にフラグが変わって再ビルドが行われると面倒なので、
基本的には`--enable-tests`も付与してビルドしてください。

## テスト

テストは以下のコマンドを実行します。

```console
cabal test --disable-optimization --enable-tests
```
