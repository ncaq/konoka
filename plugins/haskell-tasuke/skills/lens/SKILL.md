---
name: lens
description: Use the lens library, generating accessors with makeFieldsId for NoFieldSelectors records, export accessors together with their type classes, and prefer lens or OverloadedRecordDot over pattern matching. Use when writing or reviewing Haskell code that uses lens, records, or field access.
user-invocable: false
---

# [lens: Lenses, Folds and Traversals](https://hackage.haskell.org/package/lens)

## `makeFieldsId`

`NoFieldSelectors`を前提に定義したデータ構造に対して、
lensのレコードのフィールドアクセサを定義する時は、
`makeFieldsId`というTemplate Haskell関数を使ってください。

`makeFieldsId`を使うときはフィールドにプレフィクスやアンダースコアは付けないでください。
`NoFieldSelectors`拡張の力でプレフィクスは不要になっています。
`makeFieldsId`関数は完全にフィールド名と同じアクセサを生成するので、
プレフィクスやアンダースコアをつけると奇妙なアクセサが生成されてしまうのでむしろよくありません。

`makeFieldsId`は実行する段階で既に型クラスの定義が見えているならば、
型クラスの重複定義はせず既に存在する型クラスのインスタンスとしてアクセサを定義します。

そのため型クラスの重複を怖がってimportを少なくする必要はありません。
むしろ積極的に既存の型クラスをimportしてください。

循環参照が発生した場合は型クラスの定義だけを別のモジュールに分割して、
双方それをimportしてください。

## `makeFields`

サードパーティのデータ構造や自動生成されたデータ構造に対しては、
プレフィクスやアンダースコアがあるかどうかを考慮して、
`makeFields`などの他のTemplate Haskell関数を使ってください。

## lensで定義されたアクセサは型クラスごとexportする

例えば`makeFieldsId`で`HasUser`型クラスと`user`アクセサを定義した場合、
`user`アクセサをexportするのではなく、
`HasUser`型クラスを内部のアクセサも含めてexportしてください。

## なるべくlensか`OverloadedRecordDot`を使う

パターンマッチを使ってレコードのフィールドにアクセスすると、
どうしてもshadowing警告が発生しやすくなります。
そのためlensか`OverloadedRecordDot`を使ってフィールドにアクセスしてください。

## shadowing警告を回避してレコードを初期化する

データ型のフィールド名と同じ変数を定義すると、
しばしばlensのアクセサによってshadowing警告が発生します。

そのため`NamedFieldPuns`は実質使えないと考えてください。

単にフィールドを設定する場合はlensのSetterを使ってください。

初期化時などlensが使えない場合は、
フィールド名に`'`をつけた変数名を使ってください。
例えば`foo`フィールドの場合`foo'`変数を定義して、
最終的に以下のように代入に使います。

```haskell
{ foo = foo' }
```
