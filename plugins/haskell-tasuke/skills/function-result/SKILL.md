---
name: function-result
description: Do not discard a function's final value with return (), pure (), or void; adjust the type to return the value and let the caller discard it when unneeded. Use when writing or reviewing Haskell functions that return unit or discard results.
user-invocable: false
---

# 関数の最後の値は捨てない

関数の最後で、

- `return ()`
- `pure ()`
- `void`

などを使って値を捨てないでください。

特に理由がないならば関数が値を返すように型の方を合わせてください。

その時その関数の返り値が別に必要ない場合でも、
呼び出し側で捨てれば多くは問題ない話です。
呼び出し側で捨てる手間は非常に少ないです。

必要になった場合に使える余地を残しておいたほうが後々必要になった時に大きく書き換えなくて済みます。

関数の最後が`writeFile`のような、
`MonadIO m => m ()`のようにユニットを返す関数であれば、
自然とそのまま返り値を`MonadIO m => m ()`にして問題ありません。

ちょっとした補助関数を最後に呼び出して、
それの返り値を返してしまうと、
関数全体の挙動が誤解されてしまうような場合のみ、
最後の値を捨てることを検討してください。
