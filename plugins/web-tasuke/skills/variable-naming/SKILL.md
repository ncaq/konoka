---
name: variable-naming
description: Variable naming conventions for TypeScript/JavaScript. Prefer camelCase even for constants and avoid UPPER_SNAKE_CASE. Use when naming or reviewing variables or constants.
user-invocable: false
---

# 変数の命名規則 (TypeScript/JavaScript)

変数とパラメータには基本的にcamelCaseを使います。
再代入されない定数のように見える変数にも、基本的にはUPPER_SNAKE_CASEではなくcamelCaseを使います。

ファイル名とディレクトリ名については[file-naming](../file-naming/SKILL.md)を参照してください。

```typescript
// 避ける
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = "https://example.com";
const EMAIL_PATTERN = /^.+@.+$/;

// 良い
const maxRetryCount = 3;
const apiBaseUrl = "https://example.com";
const emailPattern = /^.+@.+$/;
```

## 理由

- `const`がデフォルトになった現在のコードでは、再代入されないことは`const`が既に表しています。
  UPPER_SNAKE_CASEで重ねて示すのは冗長です。
- UPPER_SNAKE_CASEにすべき「真の定数」かどうかを、宣言のたびに判断する手間がかかります。
  GoogleやAirbnbのスタイルガイドも、`const`を一律にUPPER_SNAKE_CASEにせよとは言っておらず、
  「モジュールレベルかつ意味的に深く不変なプリミティブ値」のような狭い条件に限定しています。
  `new`で生成したオブジェクト、関数、`RegExp`のように内部状態を持つ値は、
  `const`であってもこの基準では定数ではなく、境界はしばしば曖昧です。
  camelCaseに統一すればこの判断が要らなくなり、コードベース全体で命名が一貫します。
- ハードコードしていた値を後から計算式や引数に変えると、
  UPPER_SNAKE_CASEでは名前を付け替える必要が出ますが、camelCaseなら付け替えが起きません。

## 標準ライブラリやWeb APIの定数

`Math.PI`、`Number.MAX_SAFE_INTEGER`、`WebSocket.OPEN`のように、
標準ライブラリやWeb APIが提供しているUPPER_SNAKE_CASEやUPPER_CASEの定数は、
自分で命名するものではないので、提供されている名前のまま使います。

これらが大文字なのはC言語からJavaやWeb IDLへ受け継がれた歴史的な慣習によるもので、
いずれもプリミティブ型の固定値や整数の列挙値という限られた性質のものです。
自分のコードでUPPER_SNAKE_CASEを使う理由にはなりません。

## 列挙的な定数

複数の固定値をまとめて持つ定数オブジェクトや、
文字列ユニオン型の元になる配列を定義するときは、
キーも値もUPPER_SNAKE_CASEにせず、
camelCaseのオブジェクトや配列に`as const`を付ける書き方を優先します。
詳細は[as-const-satisfies](../as-const-satisfies/SKILL.md)を参照してください。

## ESLint

`@typescript-eslint/naming-convention`ルールのデフォルトは、
`variable`に対して`camelCase`と`UPPER_CASE`の両方を許容するので、
camelCaseに統一してもlintは通ります。
camelCaseだけを強制したい場合は、`variable`セレクタの`format`を`["camelCase"]`だけにします。

## 既存の規約との関係

プロジェクトやチームで既にUPPER_SNAKE_CASEの規約が採用されている場合は、そちらに従います。
この規則は、新しく方針を決められる場面でcamelCaseを優先するもので、
既存の規約を覆すものではありません。
