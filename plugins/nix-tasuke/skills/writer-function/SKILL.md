---
name: writer-function
description: Nix writer functions (writeShellApplication, writeText, etc.) for generating scripts, text files, and data. Use when creating derivations that produce scripts or configuration files.
user-invocable: false
---

# Nixのwriter系関数

ファイルやスクリプトを生成するderivationを作るための関数群です。

## シェルスクリプトには`writeShellApplication`を優先する

シェルスクリプトを書く場合は、
`writeShellScript`や`writeShellScriptBin`よりも`writeShellApplication`を優先して使います。
以下の利点があるためです。

- `set -o errexit`、`set -o nounset`、`set -o pipefail`が自動で適用されます。
  `bashOptions`で変えられます。
- ビルド時にshellcheckが自動で実行されます。
- `runtimeInputs`でPATHを管理できて、実行時の依存が明示されます。
- `runtimeEnv`で環境変数を設定できます。

## 無印と`Bin`サフィックスの違い

多くのwriter関数には、無印版と`Bin`サフィックス版があります。

- 無印(`writeShellScript`など): `$out`がファイルそのものです。
  `${myScript}`でファイルのパスを直接参照できます。
- `Bin`(`writeShellScriptBin`など): `$out/bin/<name>`にファイルを出力し、`meta.mainProgram`を設定します。
  パスは`lib.getExe myPkg`か`${myPkg}/bin/<name>`で得られます。
  `lib.getExe`のほうを推奨します。
  `$out`がファイルそのものではないので、
  `environment.systemPackages`や`runtimeInputs`に入れて`$PATH`に載せられます。

`writeShellApplication`は名前に`Bin`が付いていませんが、
`$out/bin/<name>`に出力するので`Bin`系と同じ構造です。

## trivial-builders (`pkgs.*`)

[nixpkgs/pkgs/build-support/trivial-builders/default.nix](https://github.com/NixOS/nixpkgs/blob/master/pkgs/build-support/trivial-builders/default.nix)
に定義されています。

- `writeTextFile`: テキスト系の全てのwriterの基盤になる関数です。
- `writeText name text`: テキストファイルを生成します。
- `writeTextDir path text`: ディレクトリ構造付きでテキストファイルを生成します。
- `writeScript name text` / `writeScriptBin name text`: 実行可能なスクリプトを生成します。
  シバンは自分で書きます。
- `writeShellScript name text` / `writeShellScriptBin name text`: シバンが自動で付き、構文チェックがあります。
- `writeShellApplication`: シェルスクリプト用の最も高機能なwriterです。
- `writeCBin pname code`: Cのソースをコンパイルしてバイナリを生成します。
- `concatTextFile`: 複数のファイルを連結します。
- `concatText name files`: `concatTextFile`のラッパーです。
- `concatScript name files`: 連結した実行可能なファイルを生成します。
- `writeClosure paths`: ランタイム依存のクロージャのパスの一覧を書き出します。
- `writeDirectReferencesToFile path`: 直接参照のパスの一覧を書き出します。
- `writeStringReferencesToFile string`: 文字列コンテキストの依存パスを書き出します。

## writers (`pkgs.writers.*`)

言語ごとのwriterは、
[nixpkgs/pkgs/build-support/writers/scripts.nix](https://github.com/NixOS/nixpkgs/blob/master/pkgs/build-support/writers/scripts.nix)
に定義されています。
以下の各関数には、`writeBashBin`のように`Bin`サフィックスを付けた版があり、`$out/bin/`に配置します。

- シェル: `writeBash`, `writeDash`, `writeFish`, `writeNu`
- スクリプト言語: `writeBabashka`, `writeGuile`, `writeJS`, `writeLua`, `writePerl`,
  `writePyPy2`, `writePyPy3`, `writePython3`, `writeRuby`
- コンパイル言語: `writeFSharp`, `writeHaskell`, `writeNim`, `writeRust`

これらの基盤になる関数は、
インタープリタ言語のスクリプト用の`makeScriptWriter`と、
コンパイル言語のバイナリ用の`makeBinWriter`です。

Nixの値をデータ形式のファイルとして書き出す関数は、
[nixpkgs/pkgs/build-support/writers/data.nix](https://github.com/NixOS/nixpkgs/blob/master/pkgs/build-support/writers/data.nix)
に定義されています。

- `writeJSON name data`
- `writeTOML name data`
- `writeYAML name data`
