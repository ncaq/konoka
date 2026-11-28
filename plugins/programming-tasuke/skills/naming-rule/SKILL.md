---
name: naming-rule
description: General naming rules across programming languages. Avoid meaningless words like `common` or `util`, and prefer singular base forms. Use when creating or reviewing names of files, directories, modules, functions, or variables.
user-invocable: false
---

# 命名規則

## 意味のない単語を使わない

ファイル名、ディレクトリ名、モジュール名、関数名、変数名などに、
`common`や`util`のような意味のない単語を使わないでください。
これらの単語は乱用されて意味を失っていて、見ても何を表しているのか分からないためです。

変数名に`result`のような意味のない名前も使わないでください。
その変数に何を保存しているのかが分かる名前を付けます。
実際に`Result`型に関連する処理をしている場合などは、`result`を使って構いません。

## 原形の単数形を使う

モジュール名と型の名前には、原形の単数形を使うことを推奨します。
むやみに複数形を使わないでください。

変数でも、複数形にするより、性質をより表す名前を使うことを推奨します。
