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

`packages.<system>.konoka`(`default`)はマーケットプレイス全体のパッケージです。

各プラグイン単体も`packages.<system>.<プラグイン名>`として提供しています。

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
