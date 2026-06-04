---
name: prefer-specific-method
description: Prefer the most specific built-in method over general-purpose ones in TypeScript/JavaScript. Use includes over indexOf, some over filter().length, find over filter()[0], flatMap over map().flat(), at(-1) over length-based access, startsWith/endsWith/includes over indexOf on strings, structuredClone over JSON round-trip. Use when writing or reviewing code that searches, tests, transforms arrays, objects, or strings.
user-invocable: false
---

# より特化した関数を優先する

同じ結果が得られる方法が複数ある場合は、
やりたいことに最も特化した関数を選んでください。

特化した関数は名前そのものが意図を表すので、
読み手が「この比較は何のためか」を推測せずに済みます。
汎用的な関数を条件式と組み合わせて目的を表現すると、
意図が式の形に埋もれて読みにくくなります。

これは[avoid-for](../avoid-for/SKILL.md)で`for`を高抽象度の関数に置き換えるのと同じ発想を、
関数同士の選択にも広げたものです。

## 存在するかどうかを調べる

要素が含まれるかを知りたいだけなら、
位置を返す`indexOf`ではなく、
真偽値を返す`includes`を使います。

```typescript
// 避ける
if (items.indexOf(target) !== -1) {
}

// 良い
if (items.includes(target)) {
}
```

`includes`は意図が明確なだけでなく、
`NaN`を正しく見つけられるという正確性の利点もあります。
`indexOf`は厳密等価(`===`)で比較するため`NaN`を見つけられませんが、
`includes`はSameValueZeroで比較するため`NaN`も見つけられます。

```typescript
[NaN].indexOf(NaN); // -1 (見つからない)
[NaN].includes(NaN); // true
```

## 条件を満たす要素の有無を調べる

絞り込んだ結果の件数を見るのではなく、
`some`や`every`で真偽を直接求めます。

```typescript
// 避ける
if (0 < users.filter((user) => user.active).length) {
}

// 良い
if (users.some((user) => user.active)) {
}
```

`some`は最初に条件を満たした時点で打ち切るので、
全件を絞り込む`filter`より無駄がありません。
「すべてが条件を満たすか」は`every`を使います。

## 条件を満たす最初の要素を取り出す

絞り込んでから先頭を取るのではなく、
`find`で直接取り出します。

```typescript
// 避ける
const found = users.filter((user) => user.id === targetId)[0];

// 良い
const found = users.find((user) => user.id === targetId);
```

最後の要素が欲しい場合は`findLast`、
位置が欲しい場合は`findIndex`や`findLastIndex`を使います。

## 変換してから平坦化する

`map`してから`flat`するのではなく、
`flatMap`を使います。

```typescript
// 避ける
const tags = posts.map((post) => post.tags).flat();

// 良い
const tags = posts.flatMap((post) => post.tags);
```

## 末尾や負の位置の要素にアクセスする

`length`を使った添字計算ではなく、
`at`を使います。

```typescript
// 避ける
const last = items[items.length - 1];

// 良い
const last = items.at(-1);
```

`at`は文字列にもあります。

## 文字列の前方一致と後方一致を調べる

位置を計算するのではなく、
専用のメソッドを使います。

```typescript
// 避ける
if (path.indexOf("/etc/") === 0) {
}
if (name.lastIndexOf("hosts") === name.length - "hosts".length) {
}

// 良い
if (path.startsWith("/etc/")) {
}
if (name.endsWith("hosts")) {
}
```

文字列に部分文字列が含まれるかも、
`indexOf`ではなく`includes`で調べます。

## 文字列をすべて置換する

グローバルフラグ付きの正規表現ではなく、
`replaceAll`で意図を示せます。

```typescript
// 避ける
const escaped = text.replace(/&/g, "&amp;");

// 良い
const escaped = text.replaceAll("&", "&amp;");
```

正規表現が不要な単純な文字列置換では、
`replaceAll`に文字列を直接渡せます。

## 重複を取り除く

`filter`と`indexOf`を組み合わせるのではなく、
`Set`を使います。

```typescript
// 避ける
const unique = items.filter((item, index) => items.indexOf(item) === index);

// 良い
const unique = [...new Set(items)];
```

`Set`を使う方が意図が明確で、
計算量の面でも有利です。

## オブジェクトをディープコピーする

`JSON`の往復ではなく、
`structuredClone`を使います。

```typescript
// 避ける
const copy = JSON.parse(JSON.stringify(original));

// 良い
const copy = structuredClone(original);
```

`JSON`の往復は`undefined`や`Date`や`Map`などを正しく扱えませんが、
`structuredClone`はこれらに対応します。

## 共通する考え方

汎用的な関数に条件式やフラグを足して目的を表現できると気づいたら、
その目的そのものを名前に持つ関数がないか確認してください。

- 件数や位置を求めてから比較しているなら、真偽や要素を直接返す関数があることが多い
- 複数の操作を連結しているなら、それを一度に行う関数があることが多い

特化した関数は意図が明確になるだけでなく、
途中で打ち切る、
エッジケースを正しく扱うなど、
実装上の利点も持つことが多いです。
