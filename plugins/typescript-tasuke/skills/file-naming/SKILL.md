---
name: file-naming
description: File and directory naming conventions for TypeScript/JavaScript projects. Use when creating new files or directories.
user-invocable: false
---

# ファイル名とディレクトリ名の規約

## 基本ルール

ディレクトリ名やファイル名はkebab-caseを使います。

```
src/
  api/
    customer-query.ts
```

kebab-caseを基本とする理由は以下の通りです。

URLやnpmパッケージ名などweb標準のエコシステムではkebab-caseが一般的です。
それに従ってTypeScript/JavaScriptのプロジェクトでもkebab-caseが広く採用されています。

ファイルシステムの大文字小文字の扱いがOS間で異なります。
macOSやWindowsはデフォルトでcase-insensitiveなので、
`UserList.tsx`と`userList.tsx`を区別できません。
kebab-caseならこの問題が発生しません。

## Reactコンポーネントファイル

Reactコンポーネントをエクスポートするファイルは、
同じ名前のPascalCaseを使っても構いません。

メインの利用目的と一致しているため、
対応関係が分かりやすくなります。

React公式もチュートリアルでそのような名前を使うこともあります。

```
src/
  components/
    UserList.tsx        # UserListコンポーネントをエクスポート
    SearchDialog.tsx    # SearchDialogコンポーネントをエクスポート
```

しかし全てをkebab-caseに統一するのも問題ありません。

## ReactのカスタムHooksファイル

単一のReactのカスタムHooksをexportするファイルは、
同じ名前のcamelCaseを使っても構いません。

関数名とファイル名が一致するため、
対応関係が分かりやすくなります。

React公式もチュートリアルで使っています。

eslint-plugin-react-hooksはファイル名ではなく関数名のuseプレフィックスでHooksを検出するので、
ファイル名は自由ですが、
一致させた方がわかりやすいでしょう。

```
src/
  hooks/
    useAuth.ts          # useAuth関数をエクスポート
    useLocalStorage.ts  # useLocalStorage関数をエクスポート
```

しかし全てをkebab-caseに統一するのも問題ありません。

## 通常のTypeScript/JavaScriptモジュール

kebab-caseを使うことを推奨します。

単一のexportのモジュールでも、
のちのち複数のexportが発生する可能性が割とあるので、
kebab-caseを使うことを推奨します。

## プロジェクト内での一貫性

プロジェクト内で既に採用されている規約がある場合はそちらに従ってください。

プロジェクト内で混在している場合は、
新規ファイルでは一貫した命名規則を採用して、
既存ファイルは変更のついでに徐々に統一していくのが現実的です。
