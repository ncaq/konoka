---
name: nix-command
description: Nix CLI command guidelines. Use new unified CLI (nix subcommand) instead of legacy commands (nix-build, nix-env, nix-shell, etc.). Use when running or suggesting Nix commands.
user-invocable: false
---

# Nixコマンドガイドライン

`experimental-features = nix-command flakes`が有効な環境では、
新しい統一CLI(`nix <subcommand>`形式)を使用してください。

## 旧形式コマンドの使用禁止

以下の旧形式コマンドは使用禁止です。
対応する新形式を使ってください。

### ビルド・開発環境

| 禁止(旧形式)      | 使用すべき新形式                                  |
| ----------------- | ------------------------------------------------- |
| `nix-build`       | `nix build`                                       |
| `nix-shell`       | `nix develop`(ビルド環境) / `nix shell`(一時利用) |
| `nix-instantiate` | `nix eval` / `nix derivation show`                |

### パッケージ管理

| 禁止(旧形式)                   | 使用すべき新形式           |
| ------------------------------ | -------------------------- |
| `nix-env -i` / `nix-env -iA`   | `nix profile add`          |
| `nix-env -e`                   | `nix profile remove`       |
| `nix-env -u`                   | `nix profile upgrade`      |
| `nix-env -q`                   | `nix profile list`         |
| `nix-env -qa`                  | `nix search`               |
| `nix-env --rollback`           | `nix profile rollback`     |
| `nix-env --list-generations`   | `nix profile history`      |
| `nix-env --delete-generations` | `nix profile wipe-history` |

### Nix Store操作

| 禁止(旧形式)                             | 使用すべき新形式     |
| ---------------------------------------- | -------------------- |
| `nix-store --gc` / `nix-collect-garbage` | `nix store gc`       |
| `nix-store --optimise`                   | `nix store optimise` |
| `nix-store --add`                        | `nix store add`      |
| `nix-store --delete`                     | `nix store delete`   |
| `nix-store --verify`                     | `nix store verify`   |
| `nix-store --repair-path`                | `nix store repair`   |
| `nix-store -q`                           | `nix path-info`      |
| `nix-store -qR`                          | `nix path-info -r`   |
| `nix-store -l`                           | `nix log`            |
| `nix-copy-closure`                       | `nix copy`           |

### ハッシュ

| 禁止(旧形式)             | 使用すべき新形式               |
| ------------------------ | ------------------------------ |
| `nix-hash --flat`        | `nix hash file`                |
| `nix-hash`               | `nix hash path`                |
| `nix-hash --to-base32`等 | `nix hash to-base16/32/64/sri` |
| `nix-prefetch-url`       | `nix store prefetch-file`      |

### チャンネル

| 禁止(旧形式)  | 使用すべき新形式                    |
| ------------- | ----------------------------------- |
| `nix-channel` | `nix flake update` / `nix registry` |

## 新形式コマンドの使い方

### Flake参照の構文

```text
nixpkgs#hello
github:NixOS/nixpkgs#hello
.#mypackage
path:/path/to/flake#output
```

### よく使うコマンド例

```zsh
nix build 'nixpkgs#hello'
nix build '.#mypackage'

nix develop
nix develop '.#myDevShell'

nix shell 'nixpkgs#ripgrep' 'nixpkgs#fd'

nix run 'nixpkgs#hello'

nix search nixpkgs hello

nix flake show
nix flake metadata

nix flake update
nix flake update nixpkgs

nix eval 'nixpkgs#hello.meta.description'

nix store gc

nix path-info -rSh 'nixpkgs#hello'
```

### ビルドログの表示

新形式ではビルドログがデフォルトで非表示です。
表示するには`-L`フラグを使用します。

```zsh
nix build 'nixpkgs#hello' -L
nix develop -L
```

## 注意事項

### `nix-shell`から`nix develop`/`nix shell`への移行

- `nix-shell -p pkg`: `nix shell nixpkgs#pkg`に置き換え
- `nix-shell`(ビルド環境): `nix develop`に置き換え
