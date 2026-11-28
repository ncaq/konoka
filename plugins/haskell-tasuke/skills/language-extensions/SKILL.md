---
name: language-extensions
description: Haskell language extension and language edition (GHC2024/GHC2021) selection policy. Use when configuring or reviewing Haskell language extensions, cabal default-extensions, or default-language.
user-invocable: false
---

# 言語拡張の選択方針

言語拡張のセットである言語バージョンには、使える場合は`GHC2024`を使います。
使えない場合は`GHC2021`を使います。

`GHC2024`は`GHC2021`の言語拡張に加えて、
`DataKinds`、`DerivingStrategies`、`DisambiguateRecordFields`、`ExplicitNamespaces`、
`GADTs`、`LambdaCase`、`MonoLocalBinds`、`RoleAnnotations`を含みます。

`GHC2024`に含まれていなくても、比較的安全で有用な言語拡張はデフォルトで有効にします。
cabalファイルでの典型的な設定は以下の通りです。

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

## 個別の言語拡張の採否

上の`default-extensions`に無い言語拡張のうち、以下は採否を決めています。

- デフォルトでは有効にせず、必要なときだけモジュール単位で有効にする:
  `Arrows`、`DeriveAnyClass`、`OverloadedLists`、`Strict`、`UnicodeSyntax`。
  `OverloadedRecordUpdate`もこの分類ですが、`RebindableSyntax`が必須なので現時点では使いません。
- 動作が不安定になりがちなので、ライブラリを使う都合などでどうしても必要なときだけ、
  モジュール単位で有効にする:
  `ImplicitParams`、`UndecidableInstances`。
- 危険なので使わない:
  `AllowAmbiguousTypes`、`DeferTypeErrors`、`ExtendedDefaultRules`、`ImpredicativeTypes`、
  `IncoherentInstances`、`LiberalTypeSynonyms`、`OverlappingInstances`、`RebindableSyntax`、
  `UndecidableSuperClasses`。
  GHCがエラーメッセージで有効化を提案してきた場合も有効にしません。
  `IncoherentInstances`と`OverlappingInstances`の代わりになる、
  `INCOHERENT`、`OVERLAPPABLE`、`OVERLAPPING`のプラグマも危険なので使いません。

各言語拡張の採否の理由、注意点、代替手段は[reference.md](./reference.md)にあります。
デフォルトで有効にする言語拡張についても同じです。
上に挙げた言語拡張をモジュール単位で有効にする前、
上で使わないとした言語拡張が必要に見えて代替手段を探すとき、
採否の理由を説明するときは、該当する言語拡張の節を読んでください。
