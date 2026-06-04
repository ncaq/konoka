---
name: avoid-for
description: Avoid for loops (C-style, for...of, for...in) in TypeScript/JavaScript. Prefer higher-order Array methods like map, filter, find, some, every, reduce. Use when writing or reviewing loops or iteration over arrays, objects, Map, Set, or String.
user-invocable: false
---

# `for`文をなるべく避ける

`for`文は強力すぎて、
コードの意図が読み取りにくくなります。
構造化プログラミングにおいて`goto`相当の機能を避けるのと同じ理由で、
`for`文もなるべく避けてください。

避ける対象は以下の全てです。

- C言語方式の`for (let i = 0; i < n; i++)`
- `for...of`
- `for...in`

forではありませんが、
同じくループ構文の以下も避けてください。

- `while`
- `do...while`

## なぜ避けるのか

`for`文は何でもできてしまいます。

- 要素の変換
- 絞り込み
- 集計
- 検索
- 副作用の実行

どの操作をしているのかはループ本体を注意深く読まないと分かりません。

`map`や`filter`のような高抽象度の関数は、
名前を見ただけで「変換している」「絞り込んでいる」と意図が伝わります。
`goto`が制御フローを自由にしすぎて構造化プログラミングで避けられたのと同じく、
`for`はデータの流れを自由にしすぎます。
より弱く意図の限定された関数に置き換えることで、
読み手の負担が減ります。

## Arrayの場合

Arrayのメソッドでやりたいことに対応するものを選びます。

| やりたいこと               | `for`の代替                  |
| -------------------------- | ---------------------------- |
| 各要素を変換する           | `map`                        |
| 変換して一段平坦化する     | `flatMap`                    |
| 条件で絞り込む             | `filter`                     |
| 最初の一致を探す           | `find` / `findIndex`         |
| 最後の一致を探す           | `findLast` / `findLastIndex` |
| 含まれるか調べる           | `includes`                   |
| 位置を調べる               | `indexOf` / `lastIndexOf`    |
| 一つでも満たすか調べる     | `some`                       |
| すべて満たすか調べる       | `every`                      |
| 単一の値に集計する         | `reduce` / `reduceRight`     |
| 副作用だけ実行する         | `forEach`                    |
| ネストした配列を平坦化する | `flat`                       |
| 文字列に連結する           | `join`                       |
| 並べ替える                 | `toSorted`                   |
| 逆順にする                 | `toReversed`                 |

変換と絞り込みはチェーンで素直に書けます。

```typescript
// 避ける
const result = [];
for (let i = 0; i < users.length; i++) {
  if (users[i].active) {
    result.push(users[i].name);
  }
}

// 良い
const result = users.filter((user) => user.active).map((user) => user.name);
```

### 大域脱出が必要な場合

途中で打ち切りたい(`break`相当の)場合は、
専用のメソッドで表現できます。

- 一つでも条件を満たすか: `some`
- すべて満たすか: `every`
- 最初の一致を取得: `find`

```typescript
// 避ける
let found = false;
for (const user of users) {
  if (user.id === targetId) {
    found = true;
    break;
  }
}

// 良い
const found = users.some((user) => user.id === targetId);
```

`some`と`every`と`find`は、
返値が確定した時点で反復を打ち切るので、
性能面でも`break`と同等です。

### `reduce`は控えめに使用

`reduce`は`for`よりは弱いものの、
それでも強力で読みにくくなりがちです。
`map`や`filter`や`some`で表現できる処理を`reduce`で書くのは避けてください。

単純な合計のような処理は`reduce`が適していますが、
複雑な蓄積処理を`reduce`に詰め込むと意図が埋もれます。

## Objectの場合

`for...in`ではなく、

- `Object.keys`
- `Object.values`
- `Object.entries`

などで配列に変換してから、
Arrayのメソッドを使います。

```typescript
// 避ける
for (const key in obj) {
  console.log(key, obj[key]);
}

// 良い
Object.entries(obj).forEach(([key, value]) => {
  console.log(key, value);
});
```

変換して新しいオブジェクトを作る場合は、
`Object.fromEntries`と組み合わせます。

```typescript
const upper = Object.fromEntries(
  Object.entries(obj).map(([key, value]) => [key, value.toUpperCase()]),
);
```

## MapとSetの場合

`Map`と`Set`の

- `entries`
- `keys`
- `values`

などはイテレータを返します。
イテレータには`map`や`filter`などのイテレータヘルパーが生えているので、
配列に変換せずそのままチェーンできます。
最終的に配列が必要な場合だけ`toArray`で配列にします。

```typescript
// Map
const names = userMap
  .values()
  .map((user) => user.name)
  .toArray();
const activeEntries = userMap
  .entries()
  .filter(([key, value]) => value.active)
  .toArray();

// Set
const doubled = numberSet
  .values()
  .map((n) => n * 2)
  .toArray();
```

`Map`と`Set`には`forEach`もあるので、
副作用だけ実行したい場合は直接呼べます。

イテレータヘルパーがサポートされていない環境で実行する場合や、
イテレータが対応していないメソッドを使いたい場合は、
スプレッド構文や`Array.from`で配列に変換してからArrayのメソッドを使ってください。

```typescript
const names = [...userMap.values()].map((user) => user.name);
```

## Stringの場合

文字列を1文字ずつ`for`で回す代わりに、配列やイテレータの操作に置き換えます。

- 文字ごとに処理する: スプレッド構文`[...str]`や`Array.from`で配列化する
- 区切りで分割する: `split`
- すべての一致を取り出す: `matchAll`(イテレータを返す)
- 置換する: `replaceAll`(コールバックも渡せる)

```typescript
// 避ける
let count = 0;
for (let i = 0; i < str.length; i++) {
  if (str[i] === "a") count++;
}

// 良い
const count = [...str].filter((char) => char === "a").length;
```

サロゲートペアを含む文字列では、
`[...str]`はコードポイント単位で分割するため、
`str[i]`の添字アクセスより安全です。

## 例外

### 高抽象度の関数で素直に書けない場合

高抽象度の関数で素直に書けない場合に限り、
`for...of`を使ってよいです。

- `await`を直列で実行したい場合(`for await...of`)
  - `Promise`の操作で問題ない場合は`Promise.all`などを使ってください
- 複数の配列を同時に進めるなど複雑な制御が必要な場合
- 早期`return`で関数全体を抜けたい場合

C方式の`for`や`for...in`よりは`for...of`の方がまだ読みやすいので、
どうしてもループが必要なら`for...of`を選んでください。

`for...in`はプロトタイプチェーン上のプロパティも列挙してしまうため、
ほぼ常に避けるべきです。

### 性能が格段に違う場合

性能が極めて重要で、
メソッドチェーンによる中間配列の生成がボトルネックになる場合は、
`for ... of`を使ってよいです。
ただし実際に計測して問題だと確認できた場合に限ります。
多くの場合は可読性を優先してください。

### 既存コードが使っている場合

既存コードに大量の`for`がある場合、
それらを無理に一度に書き換える必要はありません。
新しく書くコードで高抽象度の関数を優先し、
既存の`for`は変更のついでに徐々に置き換えていくのが現実的です。
