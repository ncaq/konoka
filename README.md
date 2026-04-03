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
