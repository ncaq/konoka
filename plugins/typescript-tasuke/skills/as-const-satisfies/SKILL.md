---
name: as-const-satisfies
description: Use `as const` and `as const satisfies Type` for constant definitions in TypeScript. Use when defining constants, config objects, or string union types.
user-invocable: false
---

# `as const satisfies` パターンの使用

## 基本原則

定数定義では`as const`を積極的に使用します。
`as const`によりリテラル型が保持され、
より厳密な型推論が可能になります。

名前のついている特定の型で型チェックも出来る場合は`as const satisfies Type`を使用します。
これで「`as const`を使いたいが、型のチェックもしたい」という要求を満たせます。

## 使い分け

### `as const`を使う場合

定数定義では基本的に`as const`を使います。
リテラル型の保持と型レベルでの`readonly`(ただし実行時にはオブジェクトは凍結されません)が得られます。

```typescript
const status = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
} as const;

// `status.pending`の型: "pending"
```

### `as const satisfies Type`を使う場合

`as const`の利点を保ちつつ型チェックも行いたい場合に使用します。

```typescript
const status = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
} as const satisfies Record<string, string>;

// `status.pending`の型: "pending"(リテラル型保持)
// かつ`Record<string, string>`を満たすことが保証される
```

### `: Type` や `satisfies Type` を使う場合

可変性が必要な場合や、
リテラル型の保持が問題になる場合に限り使用します。

```typescript
// 可変な配列が必要な場合
const items: string[] = [];
items.push("a"); // OK

// `as const`だと`readonly`になり`push`できない
```

## `as const satisfies`がそのまま使えないパターン

`satisfies`で指定する型が可変な型の場合、
`as const`の`readonly`性と競合してエラーになることがあります。

### 問題のあるパターン

```typescript
type Config = {
  values: string[];
};

// エラー: `readonly string[]`は`string[]`に割り当てられない
const config = {
  values: ["a", "b", "c"],
} as const satisfies Config;
```

### 解決方法: `readonly`な型を定義する

`satisfies`で使用する型自体を`readonly`にすることで解決できます。

```typescript
type Config = {
  readonly values: readonly string[];
};

const config = {
  values: ["a", "b", "c"],
} as const satisfies Config;

// `config.values`の型: `readonly ["a", "b", "c"]`
```

### `Readonly`ユーティリティ型の活用

既存の型を`readonly`化する場合は`Readonly`や再帰的な`DeepReadonly`を使用できます。

```typescript
type MutableConfig = {
  values: string[];
  nested: {
    items: number[];
  };
};

// 浅い`readonly`化
type ShallowReadonlyConfig = Readonly<MutableConfig>;

// 深い`readonly`化が必要な場合は自前で定義
// この定義はプレーンオブジェクトと配列のみを対象としています。
// Map/Set/Date等のビルトインオブジェクトを含む型には専用の対応が必要です。
type DeepReadonly<T> = T extends readonly (infer U)[] ? readonly DeepReadonly<U>[] : T extends object ? { readonly [P in keyof T]: DeepReadonly<T[P]> } : T;

type ReadonlyConfig = DeepReadonly<MutableConfig>;

const config = {
  values: ["a", "b", "c"],
  nested: {
    items: [1, 2, 3],
  },
} as const satisfies ReadonlyConfig;
```

### 配列型の`readonly`化

配列を含む型では`readonly T[]`または`ReadonlyArray<T>`を使用する。

```typescript
// どちらも同じ意味
type Items = readonly string[];
type Items2 = ReadonlyArray<string>;

const items = ["a", "b", "c"] as const satisfies readonly string[];
```

## 文字列ユニオン型は`as const`配列から導きます

文字列ユニオン型を定義するときは、
まず`as const`配列を作り、
そこから型を導きます。
直接`type Foo = "a" | "b" | "c"`とは書きません。

```typescript
// 良い
const fooValues = ["a", "b", "c"] as const;
type Foo = (typeof fooValues)[number];

// 悪い
type Foo = "a" | "b" | "c";
```

配列として値を持つことで、
ランタイムでも値の列挙が必要な場合(バリデーション等)に再利用できます。
特に`includes`で型を絞り込みやすいのがメリットです。

現時点でランタイムの列挙が不要な場合でも、
一貫性のために`as const`配列から導くスタイルに統一してください。
後からランタイムでも値が必要になったときに書き換えが発生しませんし、
コードベース内で2つのスタイルが混在するのを防げます。
