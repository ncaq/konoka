---
name: non-null-assertion
description: Do not use non-null assertion operator (!) in TypeScript. Use optional chaining, type guards, or nullish checks instead. Use when writing or reviewing TypeScript code.
user-invocable: false
---

# Non-null assertion(`!`)を使わない

Non-null assertion演算子(`!`)は使わないでください。
付けた時点でコンパイラによるnullチェックが無効になり、実行時エラーの原因になるためです。
ESLintでも`@typescript-eslint/no-non-null-assertion`ルールとしてよく禁止されています。

代わりに以下のように書きます。

- 値がnullableかもしれない場合は`?.`でアクセスします。
  `users[0]!.name`は`users[0]?.name`か`users.at(0)?.name`と書きます。
- `Map`からの取得のように型が`T | undefined`になる場面では、nullチェックで絞り込みます。
- 配列からnullableな要素を除くには`filter`を使います。
  TypeScript 5.5以降では、明示的な型述語を書かなくても`filter`で型が絞り込まれます。

```typescript
// 避ける
const config = configMap.get(key)!;
const names = users.map((u) => u.name!);

// 良い
const config = configMap.get(key);
if (config == null) {
  throw new Error(`Config not found for key: ${key}`);
}
const names = users.map((u) => u.name).filter((name) => name != null);
// names: string[]
```

## テストコード

jestやvitestの`expect(value).toBeDefined()`を書いても、TypeScriptの型はnullableのままです。
`expect`の後に`!`を付けるのではなく、Node.jsかvitestの`assert`で絞り込んでください。

```typescript
import assert from "node:assert";

const item = items.find((i) => i.id === targetId);
assert(item != null);
expect(item.name).toBe("foo");
```
