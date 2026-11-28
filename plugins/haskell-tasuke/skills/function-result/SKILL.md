---
name: function-result
description: Do not discard a function's final value with return (), pure (), or void; adjust the type to return the value and let the caller discard it when unneeded. Use when writing or reviewing Haskell functions that return unit or discard results.
user-invocable: false
---

# 関数の最後の値は捨てない

関数の最後で`return ()`、`pure ()`、`void`などを使って値を捨てないでください。
特に理由がなければ、最後の値をそのまま返すように関数の型のほうを合わせます。

今はその返り値が必要なくても、呼び出し側で捨てれば済み、その手間はわずかです。
返しておけば、後で必要になったときに大きく書き換えずに済みます。

関数の最後が`writeFile`のようにユニットを返す関数であれば、
関数の返り値もそのまま`MonadIO m => m ()`のようなユニットにして構いません。

最後に呼び出すのがちょっとした補助関数で、
その返り値を返すと関数全体の挙動が誤解されてしまう場合だけ、
最後の値を捨てることを検討してください。
