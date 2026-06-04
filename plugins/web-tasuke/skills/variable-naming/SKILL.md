---
name: variable-naming
description: Variable naming conventions for TypeScript/JavaScript. Prefer camelCase even for constants and avoid UPPER_SNAKE_CASE. Use when naming or reviewing variables or constants.
user-invocable: false
---

# 変数の命名規則 (TypeScript/JavaScript)

TypeScript/JavaScriptのコードにおける変数の命名規則です。

ファイル名やディレクトリ名については[file-naming](../file-naming/SKILL.md)を参照してください。

## 基本のケース

変数・パラメータには基本的にcamelCaseを使います。

```typescript
const taxedPrice = itemPrice * (1 + taxRate);
const userName = profile.displayName;
```

## 定数でもUPPER_SNAKE_CASEは避けてcamelCaseを使う

再代入されない定数のように見える変数でも、
基本的にはUPPER_SNAKE_CASEではなくcamelCaseを使ってください。

```typescript
// 良い
const maxRetryCount = 3;
const apiBaseUrl = "https://example.com";
const emailPattern = /^.+@.+$/;

// 避ける
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = "https://example.com";
const EMAIL_PATTERN = /^.+@.+$/;
```

理由は以下の通りです。

`const`がデフォルトになった現代のコードでは、
再代入されないことは`const`キーワードが既に表現しています。
UPPER_SNAKE_CASEで「再代入されない」ことを重ねて示すのは冗長です。

UPPER_SNAKE_CASEにすべき「真の定数」の判定は手間がかかります。
主要なスタイルガイド(GoogleやAirbnb)も`const`を一律にUPPER_SNAKE_CASEにせよとは言っておらず、
「モジュールレベルかつ意味的に深く不変なプリミティブ値」のような狭い条件に限定しています。
`new`で生成したオブジェクトや関数、`RegExp`のように内部状態を持つ値は、
`const`であってもこの基準では「定数ではない」のでcamelCaseが自然です。
この境界はしばしば曖昧で、宣言のたびに判断するコストが高いです。

ハードコードしていた値を後から計算式や引数に変えるリファクタリングをすると、
UPPER_SNAKE_CASEのままでは名前を付け替える必要が出てきます。
最初からcamelCaseで統一しておけばこの付け替えが発生しません。

camelCaseに統一すれば、
個々の変数が「真の定数」かどうかを判断する必要がなくなり、
コードベース全体で一貫した命名になります。

## 標準ライブラリやWeb APIの大文字定数について

- `Math.PI`
- `Number.MAX_SAFE_INTEGER`
- `WebSocket.OPEN`

のように標準ライブラリやWeb APIにはUPPER_SNAKE_CASE/UPPER_CASEの定数が存在します。

これらは利用する側であって自分で命名するわけではないので、
提供されている名前をそのまま使ってください。
これらの存在は、
自分のコードでUPPER_SNAKE_CASEを使う理由にはなりません。

これらが大文字なのはC言語からJavaやWeb IDLへと受け継がれた歴史的慣習によるもので、
いずれもプリミティブ型の固定値や整数の列挙値という限られた性質のものです。
自分のコードがこの慣習に追従する義務はありません。

## ESLintとの関係

`@typescript-eslint/naming-convention`ルールのデフォルトは、
`variable`に対して`camelCase`と`UPPER_CASE`の両方を許容します。
したがってcamelCaseで統一してもlintは通ります。

さらにcamelCaseだけに強制したい場合は、
`variable`セレクタの`format`を`["camelCase"]`のみに設定できます。

## 列挙的な定数値の定義

複数の固定値をまとめて持つ定数オブジェクトや、
文字列ユニオン型の元になる配列を定義する場合は、
キーも値もUPPER_SNAKE_CASEにせず、
camelCaseのオブジェクトに`as const`を付ける方法を優先します。
詳細は[as-const-satisfies](../as-const-satisfies/SKILL.md)を参照してください。

## プロジェクト内での一貫性

プロジェクトやチームで既にUPPER_SNAKE_CASEの規約が採用されている場合は、
そちらに従ってください。
新規に方針を決められる場面でcamelCaseを優先するという指針であり、
既存の規約を逐一覆すものではありません。
