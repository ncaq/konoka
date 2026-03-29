# Konoka

LLM向けのプロンプトなどを管理するためのリポジトリです。

Claude Codeプラグインマーケットプレイスとして配布しています。

## Install

```console
/plugin marketplace add ncaq/konoka
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
