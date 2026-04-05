# Project

konoka: AIコーディングアシスタント(Claude Code等)のプラグインマーケットプレイスリポジトリ。
技術スタック: Nix(flake-parts, treefmt-nix), TypeScript, Node.js。

# 出力設定

## 言語

AIは人間に話すときは日本語を使ってください。

しかし既存のコードのコメントなどが日本語ではない場合は、
コメント等は既存の言語に合わせてください。

## 記号

ASCIIに対応する全角形(Fullwidth Forms)は使用禁止。

具体的には以下のような文字:

- 全角括弧 `（）` → 半角 `()`
- 全角コロン `：` → 半角 `:`
- 全角カンマ `，` → 半角 `,`
- 全角数字 `０-９` → 半角 `0-9`

# TypeScript

## パッケージマネージャ

npmを使用します。

以下のコマンドは禁止です:

- `npx`: 代わりにPATH上のコマンドを使用
- `yarn`
- `pnpm`
- `pnpx`

# 重要コマンド

## フォーマット

基本的にファイルはツールで自動フォーマットしています。

### nix fmt

以下のコマンドでフォーマット出来ます。

```console
nix fmt
```

Stopフックで`nix fmt`が自動実行されます。
ファイルの差分が出ることがあります。

## 統合チェック

nix-fast-buildコマンドで統合チェックを実行できます。

```console
nix-fast-build --option eval-cache false --no-link --skip-cached --no-nom
```

# リポジトリ構成

Codex向けの`AGENTS.md`とClaude Code向けの`CLAUDE.md`は以下のように`.github/copilot-instructions.md`のシンボリックリンクになっています。

```console
AGENTS.md -> .github/copilot-instructions.md
CLAUDE.md -> .github/copilot-instructions.md
```

これにより各種LLM向けのドキュメントを一元管理しています。

# ワークフロー

## リリース

プラグインの追加・修正PRでは`marketplace.json`の`metadata.version`を変更しません。
リリースは`metadata.version`のみを更新する専用のリリースPRで行います。
