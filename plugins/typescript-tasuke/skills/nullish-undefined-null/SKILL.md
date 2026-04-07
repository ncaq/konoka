---
name: nullish-undefined-null
description: Prefer undefined over null in TypeScript/JavaScript. Use == null for nullish checks. Use when writing or reviewing code that handles absent values.
user-invocable: false
---

# `null`より`undefined`を優先して使う

TypeScript/JavaScriptにおいて`undefined`と`null`が両方あるのは単なる歴史的経緯による混乱なので、
なるべく`undefined`だけを使うようにしてください。

## nullを使って良い場合

### 特別なnull

既存のAPIで`null`に意味がある場合は許容されます。

例えばReactのコンポーネントが返却する`null`は何も描画しないことを表します。

そのように様々な既存のライブラリで、
`null`が自然に発生する箇所では`null`のまま扱っても構いません。
`undefined`に変換するのは必須ではありません。
「選択の余地がある場合に`undefined`を優先する」というポリシーであり、
`null`を逐一排除するものではありません。

## nullishとの比較には `== null` / `!= null` を使う

Nullish valueである`undefined`や`null`との比較には、
基本的には、
厳密等価演算子(`=== undefined`, `!== undefined`, `=== null`, `!== null`)ではなく、
抽象等価演算子 (`== null`, `!= null`) を使ってください。

`== null`は`undefined`と`null`の両方にマッチするため、
どちらか一方のチェック漏れを防げます。

これらを厳密に分ける必要はほぼないはずです。
厳密に分けているインターフェイスはあまり良くないのですが、
既存のインターフェイスがそうであれば仕方がありません。

```typescript
// 良い例
if (value == null) {
  /* value is null or undefined */
}
if (value != null) {
  /* value is neither null nor undefined */
}

// 避ける例
if (value === null || value === undefined) {
  /* 冗長 */
}
if (value !== null && value !== undefined) {
  /* 冗長 */
}
if (value === null) {
  /* undefined を見落とす可能性がある */
}
```
