---
name: dynamic-import
description: Prefer static import over dynamic import() in TypeScript/JavaScript. Use when writing or reviewing import statements.
user-invocable: false
---

# dynamic importを避ける

## 原則

TypeScript/JavaScriptコードでは通常の静的`import`を使うこと。
`import()`(dynamic import)はデフォルトでは使用禁止。

```typescript
// Good
import { foo } from "./foo";

// Bad: 読み込まれることが確定しているのにdynamic importしている
const { foo } = await import("./foo");
```

## 理由

- 静的importは依存関係がツールやバンドラにとって明確になる
- 型チェック、リファクタリング、未使用検出などの静的解析が効きやすい
- トップレベルで依存が宣言されるためコードが読みやすい
- 不要なモジュールはバンドラのツリーシェイキングで除去される

## dynamic importが許可される場合

以下のケースでは`import()`を使ってよいです。

### ルートベースのコード分割(lazy page import)

SPAのページ単位の分割など、バンドラのチャンク分割を意図する場合。

```typescript
// ルート単位のコード分割
const AdminPage = lazy(() => import("./pages/AdminPage.tsx"));
```

### 条件付きで読み込まれるモジュール

実行時の条件によって読み込み自体をスキップできる場合。

```typescript
// 開発モード専用のデバッグツール
if (process.env.NODE_ENV === "development") {
  const { installDevTools } = await import("heavy-dev-tools");
  installDevTools();
}
```

### 実行時にしかモジュールパスが決定しない場合

プラグインシステムやロケールファイルの動的読み込みなど。

バンドルしてデプロイしづらくなるためそもそも仕組みごと避けたい話ですが、
存在するときは仕方がありません。

```typescript
// ロケールに応じた翻訳ファイルの読み込み
const messages = await import(`./locales/${locale}.ts`);
```

### 循環依存の回避がどうしても必要な場合

設計の見直しを先に検討すること。
それでも解決できない場合のみ許可。
