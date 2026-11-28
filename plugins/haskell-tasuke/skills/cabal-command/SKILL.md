---
name: cabal-command
description: Use cabal with --disable-optimization for development builds and tests, and add --enable-tests to avoid rebuilds. Use when running or suggesting cabal build or test commands in Haskell development.
user-invocable: false
---

# cabalコマンド

開発中のビルドの確認とテストの実行には、以下のコマンドを使ってください。

```console
cabal build --disable-optimization --enable-tests
cabal test --disable-optimization --enable-tests
```

最適化時の挙動を確認する場合とリリースする場合を除き、
`--disable-optimization`を付けて最適化を無効にします。
Haskellはビルドに時間がかかる言語なので、ビルド時間を短縮するためです。

`build`にも基本的に`--enable-tests`を付けます。
`build`はテストをビルドするだけで実行しませんが、
付けておかないと、テストを実行するときにフラグが変わって再ビルドが行われるためです。
