---
name: lens
description: Use the lens library, generating accessors with makeFieldsId for NoFieldSelectors records, export accessors together with their type classes, and prefer lens or OverloadedRecordDot over pattern matching. Use when writing or reviewing Haskell code that uses lens, records, or field access.
user-invocable: false
---

# [lens: Lenses, Folds and Traversals](https://hackage.haskell.org/package/lens)

## アクセサの生成

`NoFieldSelectors`を前提に定義したレコードにlensのアクセサを定義するときは、
Template Haskell関数の`makeFieldsId`を使ってください。

`makeFieldsId`はフィールド名と完全に同じ名前のアクセサを生成します。
そのため、フィールド名にプレフィクスやアンダースコアを付けないでください。
付けると奇妙な名前のアクセサが生成されますし、
`NoFieldSelectors`のおかげでプレフィクスはそもそも不要です。

`makeFieldsId`は、実行する時点で既にその型クラスの定義が見えていれば、
型クラスを重複して定義せずに、既存の型クラスのインスタンスとしてアクセサを定義します。
型クラスの重複を恐れてimportを減らす必要はないので、既存の型クラスは積極的にimportしてください。
importが循環する場合は、型クラスの定義だけを別のモジュールに分けて、双方からimportします。

サードパーティのデータ構造や自動生成されたデータ構造には、
フィールド名のプレフィクスやアンダースコアの有無に合わせて、
`makeFields`などの他のTemplate Haskell関数を使います。

## アクセサのexport

lensのアクセサは型クラスごとexportします。
例えば`makeFieldsId`で`HasUser`型クラスと`user`アクセサを定義した場合は、
`user`アクセサを単独でexportするのではなく、
`HasUser`型クラスをその中のアクセサも含めてexportしてください。

## フィールドへのアクセス

レコードのフィールドには、パターンマッチではなく、
なるべくlensか`OverloadedRecordDot`でアクセスしてください。
パターンマッチで変数を束縛すると、shadowing警告が発生しやすいからです。

## レコードの初期化

フィールド名と同じ名前の変数を定義すると、
しばしばlensのアクセサとの間でshadowing警告が発生します。
そのため`NamedFieldPuns`は実質使えません。

フィールドを設定するだけの場合はlensのSetterを使います。
初期化のようにlensが使えない場合は、フィールド名に`'`を付けた名前の変数を定義して代入します。
例えば`foo`フィールドには`foo'`変数を使います。

```haskell
{ foo = foo' }
```
