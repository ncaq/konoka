---
name: async-state-type
description: Avoid contradictory state types for async data fetching. Use Suspense or discriminated unions instead. Use when writing or reviewing async data fetching code in React/TypeScript.
user-invocable: false
---

# 非同期データ取得の状態を矛盾のない型で表す

非同期データ取得の状態を、以下のように矛盾した組み合わせを許す型で表さないでください。

```typescript
// 避ける
type AsyncState<T> = {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
};
```

この型は、`data`があるのに`loading`が`true`である状態や、
`data`と`error`が同時にある状態を許してしまいます。
正しさが実行時の状態遷移に依存していて、型の上での安全性がありません。

## Suspenseを優先する

React Suspenseを使うと、ローディング中はコンポーネントがレンダリングされないので、
`data`の型が`T | undefined`ではなく`T`に確定します。
ローディングとエラーの表示は、親コンポーネントの`Suspense`と`ErrorBoundary`で扱います。

データ取得ライブラリにSuspense対応のAPIがあれば、そちらを優先して使います。
例えば、
[apollo-client](https://github.com/apollographql/apollo-client)や、
[TanStack Query](https://tanstack.com/query/latest)なら、
`useQuery`ではなく`useSuspenseQuery`を使います。

## Suspenseを使えない場合は判別共用体を使う

状態を排他的に表す判別共用体にして、`status`フィールドで分岐します。
各状態で使えるフィールドが型の上で保証されます。

```typescript
// 良い
type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "success"; data: T };
```

判別共用体を手書きする代わりに、
[Effect](https://effect.website/)の仕組みに乗せるのも良い方法です。
`Schema`でAPIレスポンスをデコードする時点で型を確定させつつ、
失敗を`Exit`や`Either`で型安全に表現できます。
