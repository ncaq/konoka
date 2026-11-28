---
name: file-naming
description: File and directory naming conventions for TypeScript/JavaScript projects. Use when creating new files or directories.
user-invocable: false
---

# ファイル名とディレクトリ名の規約

ファイル名とディレクトリ名にはkebab-caseを使います。

URLやnpmのパッケージ名などWebのエコシステムではkebab-caseが一般的で、
TypeScript/JavaScriptのプロジェクトでも広く採用されているためです。
またmacOSやWindowsのファイルシステムはデフォルトで大文字と小文字を区別しないので、
`UserList.tsx`と`userList.tsx`を区別できませんが、kebab-caseならこの問題が起きません。

## エクスポートと同じ名前にしてよいファイル

以下のファイルは、エクスポートするものと同じ名前にしても構いません。
ファイル名とエクスポートの名前が一致して、対応関係が分かりやすくなるためです。
React公式のチュートリアルにも、このような名前を使っている例があります。

- Reactコンポーネントをエクスポートするファイルは、コンポーネントと同じ名前のPascalCaseにできます。
- 単一のReactのカスタムHooksをエクスポートするファイルは、関数と同じ名前のcamelCaseにできます。
  eslint-plugin-react-hooksはファイル名ではなく関数名の`use`プレフィックスでHooksを検出するので、
  ファイル名はHooksの検出に影響しません。

これらのファイルも含めて、全てをkebab-caseに統一しても構いません。

```text
src/
  api/
    customer-query.ts
  components/
    SearchDialog.tsx    # SearchDialogコンポーネントをエクスポート
  hooks/
    useAuth.ts          # useAuth関数をエクスポート
```

それ以外のモジュールは、エクスポートが1つだけでも、その名前に合わせずkebab-caseを推奨します。
後からエクスポートが増える可能性が割とあるためです。

## 既存の規約との関係

プロジェクトで既に採用されている規約がある場合は、そちらに従います。
規約が混在している場合は、新しく作るファイルでは一貫した命名規則を使い、
既存のファイルは変更のついでに統一していきます。
