---
name: export
description: Explicitly enumerate Haskell module exports instead of exporting everything implicitly, and use re-export sparingly. Use when writing or reviewing Haskell module export lists.
user-invocable: false
---

# exportの原則

## exportは明示的に列挙する

exportでモジュールの全てのシンボルを暗黙的に公開するのは原則禁止です。

外部に公開しないといけないシンボルだけをexportしてください。

結果的に全てのシンボルをexportすることになっても、
明示的に列挙してください。

明示的に列挙することで公開しているAPIが明確になり、
デッドコードの検出なども簡単になります。

ただしTemplate Haskellでシンボルを大量に生成して、
それを全てexportしないといけない場合で、
大量生成されたシンボルを把握するのが困難な場合は、
短縮された全てをexportする構文を許可します。

## re-exportは控える

importしたモジュールを再度exportするre-exportは慎重に使ってください。

re-exportをすることでimportの依存関係が複雑になり、
循環参照のcycle importが起きた時に原因を特定するのが難しくなります。

また本来必要のない依存関係が発生していることに気が付かなくて、
インクリメンタルビルドの効率に悪影響を与えることもあります。

ライブラリやレイヤーのimportされるトップレベルモジュールの場合は、
慣習的にも問題ないことが多いです。

その他の場合は、
このモジュールを使うなら、
ほぼ絶対にセットでimportするだろうというモジュールのみをre-exportしてください。
