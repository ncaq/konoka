# Konoka

LLM向けのプロンプトなどを管理するためのリポジトリです。

Claude Codeプラグインマーケットプレイスとして配布しています。

## Install

In Claude Code.

```text
/plugin marketplace add ncaq/konoka
```

Or in project `.claude/settings.json`.

```json
{
  "extraKnownMarketplaces": {
    "konoka": {
      "source": {
        "repo": "ncaq/konoka",
        "source": "github"
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
