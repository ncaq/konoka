---
name: naming-convention
description: Nix naming conventions for files, variables, packages, and NixOS options based on nixpkgs official coding standards. Use when writing or reviewing Nix code.
user-invocable: false
---

# Nix命名規則

[nixpkgsの公式コーディング規約](https://github.com/NixOS/nixpkgs/blob/master/pkgs/README.md)に基づきます。

## ファイル名・ディレクトリ名

kebab-caseを使用します。

例: `all-packages.nix`, `claude-code.nix`

## 変数名・属性名

| 種類                          | スタイル           | 例                                     |
| ----------------------------- | ------------------ | -------------------------------------- |
| 単純な変数・関数・設定値      | lowerCamelCase     | `hostName`, `removePrefix`             |
| パッケージ・derivation        | kebab-case         | `github-mcp-server`, `claude-code-bin` |
| Flake input等の外部ソース参照 | 参照先の名前に従う | `nixpkgs-unstable`, `treefmt-nix`      |
| システム識別子                | Nixの規定形式      | `x86_64-linux`, `aarch64-linux`        |

単純な識別子はlowerCamelCaseを使用します。

パッケージやプログラムを示す変数は、
pnameと同様にkebab-caseを使用します。
2012年以降、
Nix言語では識別子にハイフンを使用できます。

Flake inputなど外部ソースを参照する変数は、
参照先のリポジトリ名やチャンネル名をそのまま使用します。
多くの場合はkebab-caseですが、
参照先の命名に従うのが原則です。

`.emacs.d` -> `dot-emacs`のような例外もあります。

システム識別子は`<arch>-<os>`の形式で、
`x86_64-linux`, `aarch64-linux`, `aarch64-darwin`などNixが規定する文字列をそのまま使用します。
Flake outputの`packages`や`devShells`の属性名として頻出します。

## NixOSオプション

原則camelCaseを使用します。

例:

- `environment.systemPackages`
- `security.tpm2.tctiEnvironment.enable`

例外:

- パッケージ名を参照する場合はkebab-case: `services.nix-serve`
- `nix.settings`など外部設定ファイルをマッピングするオプションは、その設定ファイルの命名規則に従う(nix.confはkebab-case)

### booleanオプションの`enable`プレフィックス

booleanオプションには`enable`プレフィックスを使用します。
`enabled`, `isEnabled`, `useXxx`などは使用しません。

例:

- `services.nginx.enable`
- `programs.git.enable`

## ヘルパー関数

データを生成するヘルパー関数は`mk`プレフィックスを使用します。

例:

- `mkDefault`
- `mkEnableOption`
- `mkForce`
- `mkIf`
- `mkMerge`
- `mkOption`
- `mkOverride`

データ生成系ではない場合`mk`プレフィックスのないこともあります。
`lib.types`, `lib.attrsets`, `lib.strings`などのモジュールに属する関数はlowerCamelCaseです。

例:

- `concatStringsSep`
- `filterAttrs`
- `mapAttrs`
- `optionalString`

## overlay引数

overlayの引数名は`final`/`prev`が現在の推奨です。

```nix
final: prev: {
  myPackage = prev.myPackage.overrideAttrs (oldAttrs: { });
}
```

旧来の`self`/`super`は非推奨です。
`self`はFlakeの`self`と紛らわしいため避けてください。

## 特別なファイル名

Nixエコシステムで意味を持つ特別なファイル名があります。

- `default.nix`: ディレクトリをインポートした際に自動的に読み込まれるファイル
- `flake.lock`: Flakeの依存関係のロックファイル、自動生成されます
- `flake.nix`: Flakeの定義ファイル
