---
name: language-extensions
description: Haskell language extension and language edition (GHC2024/GHC2021) selection policy. Use when configuring or reviewing Haskell language extensions, cabal default-extensions, or default-language.
user-invocable: false
---

# 言語拡張の選択方針

Haskellの言語拡張と、
言語拡張のセットである言語バージョンの選択方針について説明します。

## 基本の方針

Haskellの言語バージョンは使える場合は`GHC2024`を使用します。

使えない場合は`GHC2021`を使用します。

`GHC2024`で有効になっていなくても、
比較的安全で有用な言語拡張は有効にします。

## GHC2024に含まれている拡張

- `BangPatterns`
- `BinaryLiterals`
- `ConstrainedClassMethods`
- `ConstraintKinds`
- `DataKinds`
- `DeriveDataTypeable`
- `DeriveFoldable`
- `DeriveFunctor`
- `DeriveGeneric`
- `DeriveLift`
- `DeriveTraversable`
- `DerivingStrategies`
- `DisambiguateRecordFields`
- `DoAndIfThenElse`
- `EmptyCase`
- `EmptyDataDecls`
- `EmptyDataDeriving`
- `ExistentialQuantification`
- `ExplicitForAll`
- `ExplicitNamespaces`
- `FlexibleContexts`
- `FlexibleInstances`
- `ForeignFunctionInterface`
- `GADTSyntax`
- `GADTs`
- `GeneralisedNewtypeDeriving`
- `HexFloatLiterals`
- `ImportQualifiedPost`
- `InstanceSigs`
- `KindSignatures`
- `LambdaCase`
- `MonoLocalBinds`
- `MultiParamTypeClasses`
- `NamedFieldPuns`
- `NamedWildCards`
- `NumericUnderscores`
- `PatternGuards`
- `PolyKinds`
- `PostfixOperators`
- `RankNTypes`
- `RelaxedPolyRec`
- `RoleAnnotations`
- `ScopedTypeVariables`
- `StandaloneDeriving`
- `StandaloneKindSignatures`
- `StarIsType`
- `TraditionalRecordSyntax`
- `TupleSections`
- `TypeAbstractions`
- `TypeApplications`
- `TypeOperators`
- `TypeSynonymInstances`

## GHC2021に含まれている拡張

- `BangPatterns`
- `BinaryLiterals`
- `ConstrainedClassMethods`
- `ConstraintKinds`
- `DeriveDataTypeable`
- `DeriveFoldable`
- `DeriveFunctor`
- `DeriveGeneric`
- `DeriveLift`
- `DeriveTraversable`
- `DoAndIfThenElse`
- `EmptyCase`
- `EmptyDataDecls`
- `EmptyDataDeriving`
- `ExistentialQuantification`
- `ExplicitForAll`
- `FieldSelectors`
- `FlexibleContexts`
- `FlexibleInstances`
- `ForeignFunctionInterface`
- `GADTSyntax`
- `GeneralisedNewtypeDeriving`
- `HexFloatLiterals`
- `ImplicitPrelude`
- `ImplicitStagePersistence`
- `ImportQualifiedPost`
- `InstanceSigs`
- `KindSignatures`
- `MonomorphismRestriction`
- `MultiParamTypeClasses`
- `NamedFieldPuns`
- `NamedWildCards`
- `NoExplicitNamespaces`
- `NumericUnderscores`
- `PatternGuards`
- `PolyKinds`
- `PostfixOperators`
- `RankNTypes`
- `RelaxedPolyRec`
- `ScopedTypeVariables`
- `StandaloneDeriving`
- `StandaloneKindSignatures`
- `StarIsType`
- `TraditionalRecordSyntax`
- `TupleSections`
- `TypeApplications`
- `TypeOperators`
- `TypeSynonymInstances`

## cabalファイルの設定例

典型的なcabalファイルでの言語バージョンと言語拡張の設定は以下のようになります。

```cabal
default-language: GHC2024
default-extensions:
  ApplicativeDo
  BlockArguments
  CPP
  DefaultSignatures
  DerivingVia
  DuplicateRecordFields
  FunctionalDependencies
  LexicalNegation
  LinearTypes
  MonadComprehensions
  MultiWayIf
  NegativeLiterals
  NoFieldSelectors
  NoImplicitPrelude
  OverloadedLabels
  OverloadedRecordDot
  OverloadedStrings
  ParallelListComp
  PatternSynonyms
  QualifiedDo
  QuantifiedConstraints
  QuasiQuotes
  RecordWildCards
  RecursiveDo
  StrictData
  TemplateHaskell
  TypeData
  TypeFamilies
  TypeFamilyDependencies
  ViewPatterns
```

## 個別の言語拡張ごとの採否方針

各言語拡張を、

- デフォルトで有効にする
- 必要なときだけモジュール単位で有効にする
- 禁止する

かの個別の方針と理由は[reference.md](./reference.md)を参照してください。
