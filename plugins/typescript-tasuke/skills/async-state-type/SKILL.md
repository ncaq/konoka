---
name: async-state-type
description: Avoid contradictory state types for async data fetching. Use Suspense or discriminated unions instead. Use when writing or reviewing async data fetching code in React/TypeScript.
user-invocable: false
---

# 非同期データ取得の型設計

## 矛盾した状態を許容する型を避ける

非同期データ取得において以下のような型設計は避けてください。

```typescript
// Bad: dataにアクセス可能なのにloading/errorも同時に存在しうる
type AsyncState<T> = {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
};
```

この型は以下の問題を持ちます。

- `data`が存在するのに`loading: true`という矛盾した状態を型が許容します
- `data`と`error`が同時に存在する状態を型が許容します
- 実行時の状態遷移に依存しており、型レベルでの安全性がありません

## 推奨されるアプローチ

### Suspenseパターンを使う

React Suspenseを使えば、ローディング中はコンポーネントがレンダリングされないため、
`data`の型が確定します。

```tsx
// Good: useSuspenseQueryはdataがT型で確定している
function UserList() {
  const { data } = useSuspenseQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });
  // data: User[] (undefinedにならない)
  return (
    <ul>
      {data.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}

// 親コンポーネントでSuspenseとErrorBoundaryを使う
<ErrorBoundary fallback={<ErrorMessage />}>
  <Suspense fallback={<Loading />}>
    <UserList />
  </Suspense>
</ErrorBoundary>;
```

### 判別共用体(Discriminated Union)を使う

Suspenseが使えない場合は、状態を排他的に表現する判別共用体を使ってください。

```typescript
// Good: 状態が排他的に表現されている
type AsyncState<T> = { status: "loading" } | { status: "error"; error: Error } | { status: "success"; data: T };
```

`status`フィールドで分岐することで、各状態で利用可能なフィールドが型レベルで保証されます。

```tsx
function renderState(state: AsyncState<User[]>) {
  switch (state.status) {
    case "loading":
      return <Loading />;
    case "error":
      return <ErrorMessage error={state.error} />;
    case "success":
      return <UserList users={state.data} />;
  }
}
```

[Effect](https://effect.website/)の`Schema`を使えば、
APIレスポンスのデコード時に型を確定させつつ、
失敗を`Exit`や`Either`で型安全に表現できます。
判別共用体を手書きする代わりにEffectの仕組みに乗せるのも良いでしょう。

## ライブラリの関数選定時の注意

データ取得ライブラリを使用する場合、
Suspense対応のAPIが存在するならそちらを優先して使用してください。

例えば、
[apollo-client](https://github.com/apollographql/apollo-client)や、
[TanStack Query](https://tanstack.com/query/latest)なら、
`useQuery`ではなく`useSuspenseQuery`を使います。

Suspense対応APIは`data`が`T | undefined`ではなく`T`で返るため、型安全です。
