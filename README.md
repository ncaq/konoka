# Konoka

LLM向けのプロンプトなどを管理するためのリポジトリです。

## Setup

```console
direnv allow
```

## Format

```console
nix fmt
```

## Check

```console
nix-fast-build --option eval-cache false --no-link --skip-cached
```
