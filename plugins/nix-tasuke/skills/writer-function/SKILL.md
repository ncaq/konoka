---
name: writer-function
description: Nix writer functions (writeShellApplication, writeText, etc.) for generating scripts, text files, and data. Use when creating derivations that produce scripts or configuration files.
user-invocable: false
---

# Nixのwriter系関数

ファイルやスクリプトを生成するderivationを作るための関数群です。

## 無印と`Bin`サフィックスの違い

多くのwriter関数には無印版と`Bin`サフィックス版があります。

### 無印(`writeShellScript`等)

`$out`がファイルそのもの。
`${myScript}`でバイナリパスを直接参照できる。

### `Bin`(`writeShellScriptBin`等):

`$out/bin/<name>`にファイルを出力し`meta.mainProgram`を設定する。

`lib.getExe myPkg`や`${myPkg}/bin/<name>`でパスを得る。
`lib.getExe`の使用を推奨します。

ファイルそのものではないので、
`environment.systemPackages`や`runtimeInputs`に入れて`$PATH`に載せられます。

`writeShellApplication`は名前に`Bin`が付いていませんが`$out/bin/<name>`に出力するため`Bin`系と同じ構造です。

## trivial-builders (`pkgs.*`)

[nixpkgs/pkgs/build-support/trivial-builders/default.nix](https://github.com/NixOS/nixpkgs/blob/master/pkgs/build-support/trivial-builders/default.nix)
に定義されています。

### テキスト系

- `writeTextFile`: 全テキスト系writerの基盤関数
- `writeText name text`: テキストファイルを生成
- `writeTextDir path text`: ディレクトリ構造付きでテキストファイルを生成

### 汎用スクリプト系

- `writeScript name text` / `writeScriptBin name text`: 実行可能スクリプト、シバンは手動で記述する

### シェルスクリプト系

- `writeShellScript name text` / `writeShellScriptBin name text`: シバン自動付与、構文チェックあり
- `writeShellApplication`: シェルスクリプト用の最高機能writer

### その他

- `writeCBin pname code`: Cソースをコンパイルしてバイナリを生成
- `concatTextFile`: 複数ファイルを連結
- `concatText name files`: `concatTextFile`のラッパー
- `concatScript name files`: 実行可能な連結ファイルを生成
- `writeClosure paths`: ランタイム依存クロージャのパス一覧を書き出す
- `writeDirectReferencesToFile path`: 直接参照のパス一覧を書き出す
- `writeStringReferencesToFile string`: 文字列コンテキストの依存パスを書き出す

## writers (`pkgs.writers.*`)

[nixpkgs/pkgs/build-support/writers/scripts.nix](https://github.com/NixOS/nixpkgs/blob/master/pkgs/build-support/writers/scripts.nix)
配下に定義されています。
各関数に`Bin`サフィックス版があり、
`$out/bin/`に配置します。

### 基盤関数

- `makeScriptWriter`: インタープリタ言語用スクリプトの基盤
- `makeBinWriter`: コンパイル言語用バイナリの基盤

### シェル系

- `writeBash` / `writeBashBin`
- `writeDash` / `writeDashBin`
- `writeFish` / `writeFishBin`
- `writeNu` / `writeNuBin`

### スクリプト言語系

- `writeBabashka` / `writeBabashkaBin`
- `writeGuile` / `writeGuileBin`
- `writeJS` / `writeJSBin`
- `writeLua` / `writeLuaBin`
- `writePerl` / `writePerlBin`
- `writePyPy2` / `writePyPy2Bin`
- `writePyPy3` / `writePyPy3Bin`
- `writePython3` / `writePython3Bin`
- `writeRuby` / `writeRubyBin`

### コンパイル言語系

- `writeFSharp` / `writeFSharpBin`
- `writeHaskell` / `writeHaskellBin`
- `writeNim` / `writeNimBin`
- `writeRust` / `writeRustBin`

### データ形式系

[nixpkgs/pkgs/build-support/writers/data.nix](https://github.com/NixOS/nixpkgs/blob/master/pkgs/build-support/writers/data.nix)
に定義されています。

- `writeJSON name data`: Nixの値をJSONファイルとして書き出す
- `writeTOML name data`: Nixの値をTOMLファイルとして書き出す
- `writeYAML name data`: Nixの値をYAMLファイルとして書き出す

## `writeShellApplication`を優先する理由

シェルスクリプトを書く場合は`writeShellApplication`を優先的に使用します。

```nix
writeShellApplication {
  name = "my-script";
  runtimeInputs = with pkgs; [ curl jq ];
  text = ''
    response=$(curl -s "https://api.example.com/data")
    echo "$response" | jq '.items[]'
  '';
}
```

`writeShellScript`/`writeShellScriptBin`と比較した利点:

- `set -o errexit`, `set -o nounset`, `set -o pipefail`が自動適用されること。
  いわゆる`set -euo pipefail`がデフォルトで有効になります。
  `bashOptions`で制御可能です。
- ビルド時にshellcheckが自動実行される
- `runtimeInputs`でPATH管理ができ、実行時依存が明示的になる
- `runtimeEnv`で環境変数を設定できる
