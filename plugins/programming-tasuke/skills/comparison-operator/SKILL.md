---
name: comparison-operator
description: Prefer left-to-right ascending comparisons with less-than operators over greater-than operators, so values read in number-line order. Use when writing or reviewing comparison or range-check expressions.
user-invocable: false
---

# 比較演算子の向き

比較を書く時は、
`x > y`の形式より`x < y`の形式を優先してください。
`<`や`<=`を使い、
左から右に向かって値が大きくなるように書きます。

頭の中の数直線上に数字を左から右へ並べて考えるため、
左の方が大きいと違和感を覚えるからです。

特に範囲チェックでは、
下限と上限を数直線の並び順に書けるため読みやすくなります。

```text
// 好ましい
if (min <= x && x <= max)

// 避ける
if (x >= min && x <= max)
```

## 例外

このルールにそこまで執着はしません。
特に理由がなければ`<`や`<=`を好むという程度の優先度です。

その時書いている言語で広く普及しているリンターが、
変数を右に書くのをヨーダ記法として拒否する場合などは、
わざわざ逆らわずリンターに従ってください。
