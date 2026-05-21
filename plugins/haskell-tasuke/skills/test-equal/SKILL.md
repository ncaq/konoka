---
name: test-equal
description: When testing Either values, compare the value directly with shouldBe instead of checking isLeft, so test failures show the actual value. Use when writing or reviewing Haskell test code that asserts on Either or similar values.
user-invocable: false
---

# テストでの値の比較

## Either値をテストするときは値を直接比較する

値`x`をテストするときに、
値`x`が`Either`の値である場合は、
次のように書くのは避けます。

```haskell
isLeft x `shouldBe` True
```

このように書くとテストフレームワーク側に、
実際どのような値が入っていたのかの情報が伝わらないため、
テスト失敗時に情報がなくなってしまいます。

`Either`の値が`Eq`のインスタンスである場合は以下のように単純に比較できます。

```haskell
x `shouldBe` Left "expected error"
```

`Eq`のインスタンスでない場合でも、
`isLeft`の結果を`shouldBe`に渡すよりは、
実際の中身の振る舞いを検査できる関数が、
テストフレームワーク側に用意されているはずなので、
それを使うべきです。
