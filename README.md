# Konoka

LLM向けのプロンプトなどを管理するためのリポジトリです。

Claude Codeプラグインマーケットプレイスとして配布しています。

## Install

Claude Codeで以下を実行します。

```text
/plugin marketplace add ncaq/konoka
```

または`.claude/settings.json`に追加します。

```json
{
  "extraKnownMarketplaces": {
    "konoka": {
      "source": {
        "source": "github",
        "repo": "ncaq/konoka"
      }
    }
  }
}
```

### Nix flake

ビルド済みのプラグインをNix flakeのパッケージとしても提供しています。

一部のプラグインはTypeScriptやRust製のヘルパーを初回実行時にビルドしますが、
nix storeは読み込み専用のためランタイムビルドが出来ません。
flakeのパッケージはビルド生成物(`dist/`や`target/release/`)を同梱しているため、
そのまま利用できます。

`packages.<system>.default`はマーケットプレイス全体のパッケージです。

各プラグイン単体も`packages.<system>.<プラグイン名>`として提供しています。

### home-managerモジュール

`homeModules.default`をimportすると、
ビルド済みプラグイン一式をClaude CodeやOpenCodeへ簡単に接続できます。

```nix
{
  imports = [ inputs.konoka.homeModules.default ];

  konoka = {
    claude-code.enable = true;
    opencode.enable = true;
  };
}
```

- `konoka.claude-code.enable`は全プラグインを`programs.claude-code.plugins`へ追加します
- `konoka.opencode.enable`は各プラグインのスキルをフラットに展開して`programs.opencode.skills`へ追加し、
  スキルの埋め込みコマンドを呼び出せるようにプラグインの`bin/`を`programs.opencode.extraPackages`へ追加します

OpenCodeへ接続されるのはスキルのみです。
hooks・commands・agents・MCPサーバは連携されないため、
hookのみで構成されるプラグイン(rm-to-trashなど)はOpenCodeでは機能しません。

`programs.claude-code`や`programs.opencode`自体の有効化や設定は、
通常通りhome-manager側で行ってください。

## Development

### Setup

```console
direnv allow
```

### Format

```console
nix fmt
```

### Check

```console
nix-fast-build --option eval-cache false --no-link --skip-cached
```
