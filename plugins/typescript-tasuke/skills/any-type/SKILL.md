---
name: any-type
description: Avoid using any type in TypeScript. Use unknown, generics, or proper type definitions instead. Use when writing or reviewing TypeScript type annotations.
user-invocable: false
---

# `any`型を避ける

`any`型はTypeScriptの型チェックを完全に無効化するため、使用しないでください。
`any`を使った時点で、その値に対するあらゆる操作がコンパイル時にチェックされなくなり、
実行時エラーの原因になります。

ESLintでも`@typescript-eslint/no-explicit-any`ルールとしてよく禁止されています。

## 代替手段

### `unknown`を使う

型が不明な値を受け取る場合は`unknown`を使ってください。
`unknown`は`any`と同様にあらゆる値を代入できますが、
使用する前にtype guardで絞り込む必要があるため型安全です。

```typescript
// Bad
function parse(input: any): string {
  return input.name;
}

// Good
function parse(input: unknown): string {
  if (typeof input === "object" && input != null && "name" in input) {
    return String(input.name);
  }
  throw new Error("Invalid input");
}
```

### ジェネリクスを使う

型を呼び出し側に委ねたい場合はジェネリクスを使ってください。

```typescript
// Bad
function first(arr: any[]): any {
  return arr[0];
}

// Good
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}
```

### 適切な型定義を書く

面倒でも具体的な型を定義してください。
`any`で逃げると、その値を使うすべての箇所で型安全性が失われます。

```typescript
// Bad
const response: any = await fetch("/api/users").then((r) => r.json());

// Good
type User = {
  id: string;
  name: string;
};
const response: User[] = await fetch("/api/users").then((r) => r.json());
```

### バリデーションライブラリを使う

外部からのデータ(APIレスポンス、フォーム入力など)はバリデーションライブラリでパースしてください。
`unknown`からの手動type guardよりも安全かつ宣言的です。

```typescript
// Good: effect-schemaの例
import { Schema } from "effect";

const User = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});

const response = await fetch("/api/users").then((r) => r.json());
const users = Schema.decodeUnknownSync(Schema.Array(User))(response);
// users: { readonly id: string; readonly name: string }[]
```

### `Record`を使う

キーと値の型が分かっているオブジェクトには`Record`を使ってください。

```typescript
// Bad
const cache: any = {};

// Good
const cache: Record<string, User> = {};
```

## `any`が許容される場面

- サードパーティライブラリの型定義が壊れていて、型を正しく表現できない場合
- 既存コードの段階的な型付けにおいて、一時的に`any`を使う場合

いずれの場合も`// eslint-disable-next-line @typescript-eslint/no-explicit-any`のような抑制コメントで意図を明示してください。
