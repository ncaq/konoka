---
name: unsafe
description: Forbid unsafe Haskell functions such as unsafePerformIO, unsafeCoerce, and other unsafe-prefixed functions. Use when writing or reviewing Haskell code that uses any unsafe-prefixed function.
user-invocable: false
---

# unsafeな関数の禁止

名前に`unsafe`が付く関数は、原則として使いません。
この接頭辞は、参照透過性や型安全性といった言語の保証が効かなくなるという、
関数の作者からの警告です。

`unsafePerformIO`、`unsafeDupablePerformIO`、`unsafeInterleaveIO`、
`unsafeFixIO`、`unsafeCoerce`は特に避けます。
副作用が起きる回数やタイミングを予測できなくなったり、
型システムを迂回して、セグメンテーション違反のような、
Haskellでは本来起こり得ないクラッシュを引き起こしたりするためです。
`unsafeDupablePerformIO`は複数のスレッドから重複して実行されうるので、
`unsafePerformIO`よりも危険です。

## ライブラリが提供するunsafe関数

`bytestring`の`unsafeIndex`や`vector`の`unsafeRead`のように、
ライブラリにも境界チェックを省略する`unsafe`接頭辞の関数があります。
これらも性能のために安全性を犠牲にしているので、
原則として`indexMaybe`や`!?`などの安全な版を使います。

## `coerce`は禁止しない

`Data.Coerce.coerce`は`unsafeCoerce`と名前も用途も似ていますが、
`Coercible`制約によってコンパイル時に安全性が保証されるので、禁止の対象ではありません。
`newtype`の包み直しなどには`unsafeCoerce`ではなく`coerce`を使います。

## 使わざるを得ない場合

FFIのバインディングや、`NOINLINE`と組み合わせたグローバルな可変変数の定義のように、
`unsafePerformIO`が事実上の定石になっている領域では使って構いません。
その場合も、ライブラリやモジュールの内部に閉じ込めて、
外部には純粋で安全なAPIだけを公開します。
`unsafe`な関数を使う全ての箇所に、なぜ安全と言えるのかをコメントで書きます。
