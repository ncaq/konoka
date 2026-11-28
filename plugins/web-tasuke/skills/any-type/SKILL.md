---
name: any-type
description: Avoid using any type in TypeScript. Use unknown, generics, or proper type definitions instead. Use when writing or reviewing TypeScript type annotations.
user-invocable: false
---

# `any`型を避ける

`any`型は使わないでください。
`any`にした値への操作は全て型チェックの対象から外れ、
誤りが実行時エラーになるまで見つからなくなるためです。
ESLintでも`@typescript-eslint/no-explicit-any`ルールとしてよく禁止されています。

代わりに以下を使います。

- 型が分からない値を受け取るときは`unknown`にして、使う前に型ガードで絞り込みます。
- 型を呼び出し側に委ねたいときはジェネリクスを使います。
- キーと値の型が分かっているオブジェクトには`Record`を使います。
- APIレスポンスやフォーム入力のような外部から来るデータは、バリデーションライブラリでパースします。
  `unknown`を手書きの型ガードで絞り込むよりも安全で宣言的です。

```typescript
// EffectのSchemaモジュールでパースする例
import { Schema } from "effect";

const User = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});

const response = await fetch("/api/users").then((r) => r.json());
const users = Schema.decodeUnknownSync(Schema.Array(User))(response);
// users: readonly { readonly id: string; readonly name: string }[]
```

## `any`を使ってよい場合

- サードパーティライブラリの型定義が壊れていて、型を正しく表現できない場合。
- 既存のコードに段階的に型を付けている途中で、一時的に使う場合。

どちらの場合も、
`// eslint-disable-next-line @typescript-eslint/no-explicit-any`のような抑制コメントを付けて、
意図して使っていることを示します。
