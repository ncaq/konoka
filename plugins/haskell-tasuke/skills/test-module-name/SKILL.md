---
name: test-module-name
description: Name Haskell test modules after the module under test with a Spec suffix in the same namespace. Use when writing or reviewing Haskell test module names or test file organization.
user-invocable: false
---

# テストモジュール名

Haskell/Cabalはライブラリのディレクトリとテストのディレクトリをはっきり分けるエコシステムのため、
ディレクトリは別々となります。

テストモジュールは一般的には分かり易さのため、
テストする対象のモジュールと同じ名前空間に置いて、
テストするモジュール名の末尾に`Spec`をつけてください。

つまりテスト対象のモジュール名が`Env.Type`の場合、
テストモジュール名は`Env.TypeSpec`となります。

モジュール名が同じ空間にあることで、
関係性が分かり易くなります。

もちろん、

- 狭い挙動を深く調べたいテストモジュール
- 複数のモジュールを深く利用するテストモジュール
- 特定のモジュールに依存しないテストモジュール

これらには適切なモジュール名をつける必要があります。
