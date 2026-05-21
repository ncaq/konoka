---
name: mutable
description: Avoid mutable variables like IORef, STRef, and ST in Haskell and prefer immutable records. Use STM variables such as TVar for thread communication. Use when writing or reviewing Haskell code that uses mutable state or concurrency.
user-invocable: false
---

# mutableな変数

## 普段はmutableな変数の使用を避ける

一般的なプログラミングにおいても、
mutableな変数はできるだけ避けるべきだとされています。

特にHaskellは純粋関数型言語です。

immutableにレコードを差分更新することを効率よく行えるようになっているので、
mutableな変数が欲しいことは滅多にありません。

mutableな変数を実現する機構は原則禁止です。

例えば以下の機構は避けるべきです。

- `IORef`
- `STRef`
- `ST`

## スレッド間の通信にはSTMのミュータブルな変数を使う

スレッド間の通信を行いたい場合はミュータブルな変数を使った方がスムーズなことがあります。

例えば以下の型が該当します。

- `TVar`
- `TMVar`
- `TChan`
- `TQueue`
- `TBQueue`

しかしこれらも低レイヤーな機構なので、
そのまま深く入り組ませずに、
抽象化して使うべきです。
