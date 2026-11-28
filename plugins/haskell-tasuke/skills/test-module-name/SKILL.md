---
name: test-module-name
description: Name Haskell test modules after the module under test with a Spec suffix in the same namespace. Use when writing or reviewing Haskell test module names or test file organization.
user-invocable: false
---

# テストモジュール名

テストモジュールは、テスト対象のモジュールと同じ名前空間に置き、
テスト対象のモジュール名の末尾に`Spec`を付けた名前にしてください。
テスト対象が`Env.Type`なら、テストモジュールは`Env.TypeSpec`です。

Haskell/Cabalはライブラリのディレクトリとテストのディレクトリをはっきり分けるエコシステムなので、
ディレクトリは別々になります。
モジュール名を同じ名前空間に揃えることで、テストとテスト対象の関係が分かりやすくなります。

以下のテストモジュールには、テスト対象のモジュール名に合わせるのではなく、
テストの内容を表すモジュール名を付けます。

- 狭い挙動を深く調べるテストモジュール
- 複数のモジュールを深く利用するテストモジュール
- 特定のモジュールに依存しないテストモジュール
