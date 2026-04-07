---
name: non-null-assertion
description: Do not use non-null assertion operator (!) in TypeScript. Use optional chaining, type guards, or nullish checks instead. Use when writing or reviewing TypeScript code.
user-invocable: false
---

# Non-null Assertion (`!`)の禁止

Non-null assertion演算子(`!`)はTypeScriptの型安全性を破壊するため、使用しないでください。

`!`を付けた時点でコンパイラによるnullチェックが無効化され、実行時エラーの原因になります。

ESLintでも`@typescript-eslint/no-non-null-assertion`ルールとしてよく禁止されています。

## 代替手段

### Optional chaining

値がnullableかもしれない場合は`?.`で安全にアクセスしてください。

```typescript
// Bad
const name = users[0]!.name;

// Good
const name = users[0]?.name;
const name = users.at(0)?.name;
```

### Type guardによる絞り込み

Map等からの取得など、型が`T | undefined`になる場面ではnullチェックで絞り込んでください。

```typescript
// Bad
const config = configMap.get(key)!;
applyConfig(config);

// Good
const config = configMap.get(key);
if (config == null) {
  throw new Error(`Config not found for key: ${key}`);
}
applyConfig(config);
```

### `filter`の使用

`filter`はtype guardとして機能するため、
nullableな要素の除去に活用できます。
明示的なtype predicateの記述は不要です。

```typescript
// Bad: non-null assertionで無理やり絞り込む
const names = users.map((u) => u.name!);

// Good: filterで型安全にundefinedを除去(TypeScript 5.5以降)
const names = users.map((u) => u.name).filter((name) => name != null);
// names: string[]
```

### テストコードでの扱い

jestやvitestで`expect(value).toBeDefined()`を書いてもTypeScript上はnullableのままです。
Node.jsやvitestの`assert`を使ってください。

```typescript
// Bad: expectの後でも型は絞り込まれない
const item = items.find((i) => i.id === targetId);
expect(item).toBeDefined();
expect(item!.name).toBe("foo");

// Good: assertで絞り込む
import assert from "node:assert";
const item = items.find((i) => i.id === targetId);
assert(item != null);
expect(item.name).toBe("foo");
```
