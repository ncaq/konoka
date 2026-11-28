---
name: dynamic-import
description: Prefer static import over dynamic import() in TypeScript/JavaScript. Use when writing or reviewing import statements.
user-invocable: false
---

# dynamic importを避ける

TypeScriptとJavaScriptのコードでは、後述の場合を除き、
`import()`(dynamic import)ではなく通常の静的な`import`を使ってください。

静的な`import`は依存関係がトップレベルで宣言されるので、コードが読みやすくなります。
依存関係がツールやバンドラにとって明確になり、
型チェック、リファクタリング、未使用の検出などの静的解析も効きやすくなります。
静的に`import`しても、不要なモジュールはバンドラのツリーシェイキングで除去されます。

```typescript
// 避ける: 読み込まれることが確定しているのにdynamic importしている
const { foo } = await import("./foo");

// 良い
import { foo } from "./foo";
```

## `import()`を使ってよい場合

- ルート単位のコード分割(ページの遅延読み込み)。
  SPAのページ単位の分割など、バンドラのチャンク分割を意図する場合です。
- 実行時の条件によって、読み込み自体を省けるモジュール。
  開発モード専用のデバッグツールなどです。
- モジュールのパスが実行時にしか決まらない場合。
  プラグインシステムや、ロケールに応じた翻訳ファイルの読み込みなどです。
  バンドルしてデプロイしづらくなるので仕組みごと避けたいところですが、
  既に存在するときは`import()`を使います。
- 循環依存の回避がどうしても必要な場合。
  先に設計の見直しを検討し、それでも解決できないときだけ使います。
