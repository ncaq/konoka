---
name: test-equal
description: When testing Either values, compare the value directly with shouldBe instead of checking isLeft, so test failures show the actual value. Use when writing or reviewing Haskell test code that asserts on Either or similar values.
user-invocable: false
---

# テストでは値を直接比較する

`Either`などの値をテストするときに、
`isLeft`のような判定の結果を`True`と比較する書き方は避けます。
実際にどのような値が入っていたのかがテストフレームワークに伝わらず、
テストが失敗したときに情報がなくなるためです。

```haskell
-- 避ける
isLeft x `shouldBe` True

-- 良い
x `shouldBe` Left "expected error"
```

値が`Show`と`Eq`のインスタンスなら、期待する値と直接比較します。
`Eq`のインスタンスでない場合も、`isLeft`の結果を`shouldBe`に渡すのではなく、
中身の振る舞いを検査できる関数がテストフレームワークに用意されているはずなので、それを使います。
