---
name: avoid-for
description: Avoid for loops (C-style, for...of, for...in) in TypeScript/JavaScript. Prefer higher-order Array methods like map, filter, find, some, every, reduce. Use when writing or reviewing loops or iteration over arrays, objects, Map, Set, or String.
user-invocable: false
---

# ループ文より高階関数を使う

`for`、`for...of`、`for...in`、`while`、`do...while`はなるべく避けて、
`map`や`filter`のような意図の限定された高階関数で書いてください。

ループ文は変換も絞り込みも集計も検索も副作用の実行も書けてしまうので、
何をしているのかは本体を注意深く読まないと分かりません。
`map`や`filter`は名前を見ただけで意図が伝わります。
構造化プログラミングが`goto`を避けるのと同じ理由です。

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

## 書き方の選び方

- 途中で打ち切りたい処理は`some`、`every`、`find`で書きます。
  結果が確定した時点で反復を打ち切るので、性能も`break`と同等です。
- 副作用だけを実行する場合は`forEach`を使います。
- 並べ替えや逆順には`toSorted`と`toReversed`を使います。
- `reduce`は`for`よりは弱いものの、読みにくくなりがちです。
  `map`や`filter`や`some`で書ける処理には使わず、合計のような単純な集計に留めます。
- オブジェクトは`Object.keys`、`Object.values`、`Object.entries`で配列にしてから処理します。
  新しいオブジェクトを作るときは`Object.fromEntries`と組み合わせます。
- `Map`と`Set`の`entries`、`keys`、`values`が返すイテレータには、
  `map`や`filter`などのイテレータヘルパーをそのまま呼べます。
  配列が必要なときだけ最後に`toArray`を呼びます。
  イテレータヘルパーが使えない環境や、イテレータに無いメソッドを使いたい場合は、
  スプレッド構文か`Array.from`で配列にします。
- 文字列を1文字ずつ処理するときは`[...str]`か`Array.from`で配列にします。
  コードポイント単位で分割されるので、サロゲートペアを含む文字列でも`str[i]`より安全です。
  区切りでの分割には`split`、全ての一致の取得には`matchAll`、置換には`replaceAll`を使います。

```typescript
const upper = Object.fromEntries(
  Object.entries(obj).map(([key, value]) => [key, value.toUpperCase()]),
);

const names = userMap
  .values()
  .map((user) => user.name)
  .toArray();

const count = [...str].filter((char) => char === "a").length;
```

## ループ文を使ってよい場合

以下の場合は`for...of`を使って構いません。
C言語方式の`for`や`for...in`よりは読みやすいので、ループ文が必要なら`for...of`を選びます。
`for...in`はプロトタイプチェーン上のプロパティも列挙してしまうので、ほぼ常に避けます。

- `await`を直列に実行する必要がある場合。
  並列で問題なければ`Promise.all`などを使います。
- 複数の配列を同時に進めるなど、高階関数では素直に書けない制御が必要な場合。
- 早期`return`で関数全体を抜けたい場合。
- メソッドチェーンによる中間配列の生成がボトルネックになっていると、計測して確認できた場合。
  確認できていなければ可読性を優先します。

既存のコードにあるループ文を、一度に書き換える必要はありません。
新しく書くコードで高階関数を使い、既存のループ文は変更のついでに置き換えていきます。
