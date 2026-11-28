---
name: use-error-info
description: When handling errors locally instead of propagating them, include the error data in logs or messages. Never discard caught errors with `_`. Use when writing try/catch, Result handling, or error case branches.
user-invocable: false
---

# エラー処理時にエラーデータを使う

`catch`や`case`で受け取ったエラーを、上流に伝播させずにその場で処理するときは、
受け取ったエラーデータを捨てずに、ログやメッセージに含めるなどして使ってください。
開発者や利用者が問題を把握しやすくするためです。

例えば、原因を修正するのは難しいけれど致命的な問題にはならないエラーは、
警告ログを出力してそのまま続行するのが普通です。
その警告ログにエラーデータの内容を含めます。

エラーデータを`_`などに束縛して、使わずに捨てることは禁止です。
