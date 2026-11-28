---
name: nix-command
description: Nix CLI command guidelines. Use new unified CLI (nix subcommand) instead of legacy commands (nix-build, nix-env, nix-shell, etc.). Use when running or suggesting Nix commands.
user-invocable: false
---

# Nixは新しい統一CLIを使う

`experimental-features = nix-command flakes`が有効な環境では、
`nix-build`や`nix-env`のような旧形式のコマンドを使わず、
新しい統一CLI(`nix <subcommand>`形式)を使ってください。

新形式はビルドログをデフォルトでは表示しません。
ビルドログを表示するには`-L`を付けます。

```zsh
nix build 'nixpkgs#hello' -L
nix develop -L
```

## 旧形式と新形式の対応

| 旧形式                                   | 新形式                              |
| ---------------------------------------- | ----------------------------------- |
| `nix-build`                              | `nix build`                         |
| `nix-shell`(ビルド環境)                  | `nix develop`                       |
| `nix-shell -p pkg`(一時利用)             | `nix shell nixpkgs#pkg`             |
| `nix-instantiate`                        | `nix eval` / `nix derivation show`  |
| `nix-env -i` / `nix-env -iA`             | `nix profile add`                   |
| `nix-env -e`                             | `nix profile remove`                |
| `nix-env -u`                             | `nix profile upgrade`               |
| `nix-env -q`                             | `nix profile list`                  |
| `nix-env -qa`                            | `nix search`                        |
| `nix-env --rollback`                     | `nix profile rollback`              |
| `nix-env --list-generations`             | `nix profile history`               |
| `nix-env --delete-generations`           | `nix profile wipe-history`          |
| `nix-store --gc` / `nix-collect-garbage` | `nix store gc`                      |
| `nix-store --optimise`                   | `nix store optimise`                |
| `nix-store --add`                        | `nix store add`                     |
| `nix-store --delete`                     | `nix store delete`                  |
| `nix-store --verify`                     | `nix store verify`                  |
| `nix-store --repair-path`                | `nix store repair`                  |
| `nix-store -q`                           | `nix path-info`                     |
| `nix-store -qR`                          | `nix path-info -r`                  |
| `nix-store -l`                           | `nix log`                           |
| `nix-copy-closure`                       | `nix copy`                          |
| `nix-hash --flat`                        | `nix hash file`                     |
| `nix-hash`                               | `nix hash path`                     |
| `nix-hash --to-base32`等                 | `nix hash convert`                  |
| `nix-prefetch-url`                       | `nix store prefetch-file`           |
| `nix-channel`                            | `nix flake update` / `nix registry` |
