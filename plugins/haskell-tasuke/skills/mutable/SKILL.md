---
name: mutable
description: Avoid mutable variables like IORef, STRef, and ST in Haskell and prefer immutable records. Use STM variables such as TVar for thread communication. Use when writing or reviewing Haskell code that uses mutable state or concurrency.
user-invocable: false
---

# mutableな変数

## 普段はmutableな変数を使わない

`IORef`、`STRef`、`ST`のような、mutableな変数を実現する機構は原則として使いません。
Haskellではレコードをimmutableなまま差分更新することを効率よく行えるので、
mutableな変数が欲しくなることは滅多にないためです。

## スレッド間の通信にはSTMのmutableな変数を使う

スレッド間の通信では、mutableな変数を使ったほうがスムーズなことがあります。
その場合は`TVar`、`TMVar`、`TChan`、`TQueue`、`TBQueue`のようなSTMの型を使います。

これらも低レイヤーの機構なので、
そのまま深く入り組ませずに、抽象化して使います。
