---
name: nullish-undefined-null
description: Prefer undefined over null in TypeScript/JavaScript. Use == null for nullish checks. Use when writing or reviewing code that handles absent values.
user-invocable: false
---

# `null`より`undefined`を優先して使う

TypeScript/JavaScriptに`undefined`と`null`の両方があるのは、単なる歴史的経緯による混乱です。
どちらを使うか選べる場合は`undefined`を使ってください。

`null`を逐一排除する方針ではありません。
Reactのコンポーネントが何も描画しないことを表すために返す`null`のように、
既存のAPIで`null`に意味がある箇所や、既存のライブラリから`null`が自然に出てくる箇所では、
`null`のまま扱って構いません。
`undefined`への変換は必須ではありません。

## nullishとの比較には`== null`と`!= null`を使う

`undefined`や`null`との比較には、
厳密等価演算子(`=== undefined`、`!== undefined`、`=== null`、`!== null`)ではなく、
`== null`と`!= null`を使ってください。
`undefined`と`null`の両方に一致するので、どちらか一方のチェック漏れを防げます。

```typescript
// 避ける
if (value === null || value === undefined) {
  // 冗長
}
if (value === null) {
  // undefinedを見落とす可能性がある
}

// 良い
if (value == null) {
  // valueはnullかundefined
}
if (value != null) {
  // valueはnullでもundefinedでもない
}
```

`undefined`と`null`を厳密に区別する必要はほぼありません。
区別しているインターフェイスは良い設計ではありませんが、
既存のインターフェイスが区別している場合は、それに合わせて厳密等価演算子を使います。

ESLintの`eqeqeq`ルールが`always`に設定されていると`== null`は警告されます。
ただし現代の一般的なESLint設定では`smart`オプションが有効で、
`null`との比較に`==`と`!=`を使うことは許容されるので、基本的に問題ありません。
