---
name: naming-convention
description: Nix naming conventions for files, variables, packages, and NixOS options based on nixpkgs official coding standards. Use when writing or reviewing Nix code.
user-invocable: false
---

# Nix命名規則

[nixpkgsの公式コーディング規約](https://github.com/NixOS/nixpkgs/blob/master/pkgs/README.md)に基づきます。

## ファイル名とディレクトリ名

kebab-caseにします。

例: `all-packages.nix`, `claude-code.nix`

## 変数名と属性名

- 単純な変数、関数、設定値: lowerCamelCaseにします。
  例: `hostName`, `removePrefix`
- パッケージ、derivation、プログラムを指す変数: `pname`と同じくkebab-caseにします。
  Nix言語は2012年以降、識別子にハイフンを使えます。
  例: `github-mcp-server`, `claude-code`
- Flake inputなど外部ソースを参照する変数: 参照先のリポジトリ名やチャンネル名をそのまま使います。
  例: `nixpkgs-unstable`, `treefmt-nix`
  多くの場合はkebab-caseになりますが、参照先の命名に従うのが原則です。
  `.emacs.d`を`dot-emacs`とするような例外もあります。
- システム識別子: Nixが規定する`<arch>-<os>`の形式の文字列をそのまま使います。
  例: `x86_64-linux`, `aarch64-linux`, `aarch64-darwin`

## NixOSオプション

原則としてlowerCamelCaseにします。

例: `environment.systemPackages`, `security.tpm2.tctiEnvironment.enable`

以下は例外です。

- パッケージ名を参照する場合はkebab-caseにします。
  例: `services.nix-serve`
- `nix.settings`のように外部の設定ファイルをマッピングするオプションは、
  その設定ファイルの命名規則に従います。
  nix.confはkebab-caseです。

booleanのオプションには`enable`プレフィックスを使います。
`enabled`、`isEnabled`、`useXxx`などは使いません。

例: `services.nginx.enable`, `programs.git.enable`

## ヘルパー関数

データを生成するヘルパー関数には`mk`プレフィックスを付けます。

例: `mkDefault`, `mkEnableOption`, `mkForce`, `mkIf`, `mkMerge`, `mkOption`, `mkOverride`

データを生成しない関数には、`mk`プレフィックスを付けないこともあります。
`lib.types`、`lib.attrsets`、`lib.strings`などに属する関数はlowerCamelCaseです。

例: `concatStringsSep`, `filterAttrs`, `mapAttrs`, `optionalString`

## overlayの引数

overlayの引数名は`final`と`prev`にします。
旧来の`self`と`super`は非推奨です。
`self`はFlakeの`self`と紛らわしいので避けてください。

```nix
final: prev: {
  myPackage = prev.myPackage.overrideAttrs (oldAttrs: { });
}
```
