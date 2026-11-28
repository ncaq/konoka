---
name: prefer-specific-method
description: Prefer the most specific built-in method over general-purpose ones in TypeScript/JavaScript. Use includes over indexOf, some over filter().length, find over filter()[0], flatMap over map().flat(), at(-1) over length-based access, startsWith/endsWith/includes over indexOf on strings, structuredClone over JSON round-trip. Use when writing or reviewing code that searches, tests, transforms arrays, objects, or strings.
user-invocable: false
---

# より特化した関数を優先する

同じ結果が得られる書き方が複数あるときは、やりたいことに最も特化した関数を選んでください。

特化した関数は名前そのものが意図を表すので、
読み手が式の形から「この比較は何のためか」を推測せずに済みます。
途中で打ち切る、エッジケースを正しく扱うといった、実装上の利点を持つことも多いです。

[avoid-for](../avoid-for/SKILL.md)でループ文を高階関数に置き換えるのと同じ発想を、
関数同士の選択にも広げたものです。

```typescript
// 避ける
if (0 < users.filter((user) => user.active).length) {
}

// 良い
if (users.some((user) => user.active)) {
}
```

## 置き換える書き方

- 要素が含まれるかは、`items.indexOf(target) !== -1`ではなく`items.includes(target)`で調べます。
  `indexOf`は`===`で比較するので`NaN`を見つけられませんが、
  `includes`はSameValueZeroで比較するので`NaN`も見つけられます。
- 条件を満たす要素があるかは、`filter`の結果の件数を見るのではなく、`some`で調べます。
  全ての要素が条件を満たすかは`every`で調べます。
  `some`は最初に条件を満たした時点で打ち切るので、全件を絞り込む`filter`より無駄がありません。
- 条件を満たす最初の要素は、`items.filter(fn)[0]`ではなく`items.find(fn)`で取り出します。
  最後の要素が欲しいときは`findLast`、位置が欲しいときは`findIndex`や`findLastIndex`を使います。
- 変換してから平坦化するときは、`items.map(fn).flat()`ではなく`items.flatMap(fn)`を使います。
- 末尾や負の位置の要素は、`items[items.length - 1]`のような添字の計算ではなく、
  `items.at(-1)`で取り出します。
  `at`は文字列にもあります。
- 文字列の前方一致と後方一致は、
  `path.indexOf("/etc/") === 0`のように`indexOf`や`lastIndexOf`で位置を計算するのではなく、
  `startsWith`と`endsWith`で調べます。
  部分文字列が含まれるかも、`indexOf`ではなく`includes`で調べます。
- 文字列を全て置換するときは、
  `text.replace(/&/g, "&amp;")`のようにグローバルフラグ付きの正規表現を使うのではなく、
  `text.replaceAll("&", "&amp;")`のように`replaceAll`を使います。
  正規表現が要らない単純な置換では、`replaceAll`に文字列をそのまま渡せます。
- 重複を取り除くときは、
  `items.filter((item, index) => items.indexOf(item) === index)`ではなく、
  `[...new Set(items)]`を使います。
  計算量の面でも有利です。
- オブジェクトをディープコピーするときは、
  `JSON.parse(JSON.stringify(original))`ではなく`structuredClone(original)`を使います。
  `JSON`の往復は`undefined`や`Date`や`Map`などを正しく扱えませんが、
  `structuredClone`はこれらに対応します。

## ここに無い書き方

汎用的な関数に条件式やフラグを足して目的を表現していると気づいたら、
その目的そのものを名前に持つ関数がないか確認してください。

- 件数や位置を求めてから比較しているなら、真偽値や要素を直接返す関数があることが多いです。
- 複数の操作を連結しているなら、それを一度に行う関数があることが多いです。
