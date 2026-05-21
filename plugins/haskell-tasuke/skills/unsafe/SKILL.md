---
name: unsafe
description: Forbid unsafe Haskell functions such as unsafePerformIO, unsafeCoerce, and other unsafe-prefixed functions. Use when writing or reviewing Haskell code that uses any unsafe-prefixed function.
user-invocable: false
---

# unsafeな関数の禁止

名前に`unsafe`が付く関数は、
参照透過性や型安全性といったHaskellの根幹の保証を破壊するため、
原則として使用を禁止します。

`unsafe`接頭辞は「これを使うと言語の保証が効かなくなる」という作者からの警告です。

## 特に避けるべき関数

### unsafePerformIO

`IO`アクションを純粋なコンテキストで実行します。

参照透過性を破壊します。
GHCの最適化により評価回数や評価順序が変わったり、
共有によって一度しか実行されなかったりするため、
副作用のタイミングを予測できなくなります。

### unsafeDupablePerformIO

`unsafePerformIO`の制約をさらに緩めたものです。
複数のスレッドから同時に、
あるいは重複して実行される可能性があり、
`unsafePerformIO`よりも危険です。

### unsafeInterleaveIO

`IO`アクションを遅延実行します。
実際に値が必要になるまで実行が遅延されるため、
副作用の発生タイミングが完全に非決定的になります。
遅延IOにまつわる諸問題の原因です。

### unsafeFixIO

`IO`における不動点を計算します。
まだ定まっていない値を参照するとデッドロックや実行時エラーになります。

### unsafeCoerce

ある型の値を無検査で別の型へ変換します。
型システムを完全に迂回するため、
誤用するとセグメンテーション違反など、
Haskellでは本来起こり得ないクラッシュを引き起こします。

## ライブラリが提供するunsafe関数

`bytestring`の`unsafeIndex`や、
`vector`の`unsafeRead`など、
ライブラリにも境界チェックを省略する`unsafe`接頭辞の関数があります。

これらもパフォーマンスのために安全性を犠牲にしているので、
原則として安全版である`indexMaybe`や`!?`などを使ってください。

## coerceとの混同に注意

`Data.Coerce.coerce`は`unsafeCoerce`と名前も用途も似ていますが別物です。
`coerce`は`Coercible`制約によってコンパイル時に安全性が保証されるため、
こちらは禁止しません。
`newtype`の包み直しなどでは`unsafeCoerce`ではなく`coerce`を使ってください。

## 使わざるを得ない場面

FFIのバインディングや、
`NOINLINE`と組み合わせたグローバルな可変変数の定義など、
`unsafePerformIO`が事実上の定石になっている領域があります。

そうした場合でも、
ライブラリやモジュールの内部に閉じ込めて、
外部には純粋で安全なAPIだけを公開してください。
そしてなぜ安全と言えるのかをコメントで必ず明示してください。
