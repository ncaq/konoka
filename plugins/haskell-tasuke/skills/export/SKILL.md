---
name: export
description: Explicitly enumerate Haskell module exports instead of exporting everything implicitly, and use re-export sparingly. Use when writing or reviewing Haskell module export lists.
user-invocable: false
---

# exportの原則

## exportは明示的に列挙する

モジュールの全てのシンボルを暗黙的にexportすることはせず、
外部に公開する必要があるシンボルだけを明示的に列挙してください。
公開しているAPIが明確になり、デッドコードの検出も簡単になるためです。
結果として全てのシンボルをexportすることになる場合も、明示的に列挙します。

例外として、Template Haskellが大量に生成するシンボルを全てexportする必要があり、
生成されるシンボルを把握するのが困難な場合は、
全てをexportする短縮の構文を使って構いません。

## re-exportは控える

importしたモジュールを再びexportするre-exportは、以下の場合に留めてください。

- ライブラリやレイヤーの、外からimportされるトップレベルのモジュールである場合。
  慣習的にも問題ないことが多いです。
- そのモジュールを使うなら、ほぼ確実にセットでimportすると言えるモジュールをre-exportする場合。

re-exportはimportの依存関係を複雑にするので、
循環importが起きたときに原因を特定しにくくなります。
本来は必要のない依存関係が生じていることにも気づきにくくなり、
インクリメンタルビルドの効率に悪影響を与えることがあります。
