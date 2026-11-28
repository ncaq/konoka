---
name: as-const-satisfies
description: Use `as const` and `as const satisfies Type` for constant definitions in TypeScript. Use when defining constants, config objects, or string union types.
user-invocable: false
---

# 定数定義には`as const`と`as const satisfies`を使う

定数定義には基本的に`as const`を付けます。
リテラル型が保たれて型推論が厳密になり、型の上で`readonly`になるためです。
実行時にオブジェクトが凍結されるわけではありません。

名前の付いた型で型チェックもできる場合は、`as const satisfies Type`にします。
`as const`の利点を保ったまま、その型を満たすことも保証できます。

```typescript
const status = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
} as const satisfies Record<string, string>;
// status.pendingの型は"pending"
```

`: Type`や、`as const`を付けない`satisfies Type`は、
要素を`push`する配列のように可変性が必要な場合と、
リテラル型が保たれると問題になる場合に限って使います。

## `satisfies`に指定する型の配列が可変な場合

`satisfies`に指定する型の配列が`string[]`のように可変だと、
配列リテラルはエラーにならないまま、`readonly`の付かないタプルに推論されます。
既に`readonly`な配列を渡した場合はエラーになります。
どちらの場合も、`satisfies`に指定する型の側を`readonly`にします。

```typescript
type Config = {
  readonly values: readonly string[];
};

const config = {
  values: ["a", "b", "c"],
} as const satisfies Config;
// config.valuesの型はreadonly ["a", "b", "c"]
```

既存の型を`readonly`にするには`Readonly`を使えます。
`Readonly`は浅い`readonly`化なので、
プロパティにある配列まで`readonly`にするには、再帰的な`DeepReadonly`を自前で定義します。

```typescript
// プレーンオブジェクトと配列だけを対象にした定義です。
// Map、Set、Dateなどのビルトインオブジェクトを含む型には専用の対応が必要です。
type DeepReadonly<T> = T extends readonly (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
    : T;
```

`DeepReadonly`やビルトインオブジェクトへの対応などで、
型の側の調整が複雑になりすぎる場合は、
`as const`にこだわらず、通常の型推論や型注釈で済ませて構いません。
リテラル型のために可読性を大きく犠牲にする必要はありません。

## 文字列ユニオン型は`as const`配列から導く

文字列ユニオン型は直接書かず、
先に`as const`配列を作って、そこから型を導きます。

```typescript
// 避ける
type Foo = "a" | "b" | "c";

// 良い
const fooValues = ["a", "b", "c"] as const;
type Foo = (typeof fooValues)[number];
```

配列として値を持っていれば、
バリデーションのように実行時にも値の列挙が必要な場合に再利用できます。
特に`includes`で型を絞り込みやすいのが利点です。

実行時の列挙が今は必要ない場合も、一貫性のためにこの書き方に統一します。
後から実行時に値が必要になっても書き換えが発生せず、
コードベースに2つの書き方が混在することも防げます。
