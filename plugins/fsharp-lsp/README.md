# fsharp-lsp

F#開発のためのClaude Codeプラグインです。

F#の言語サーバである[fsautocomplete](https://github.com/ionide/FsAutoComplete)(FSAC)を、
Claude CodeのLSP統合へ接続します。
接続するとClaude Codeのセッション内で以下が使えるようになります。

- 編集後の診断(エラー・警告)の自動取得
- 定義ジャンプ
- 参照検索
- hover(型情報・ドキュメント)
- シンボル検索

## 前提条件

`fsautocomplete`コマンドがPATH上に存在する必要があります。
このプラグインは接続設定のみを提供し、
言語サーバ本体は含みません。

Nix環境ならnixpkgsの`fsautocomplete`パッケージをdevShellなどへ追加してください。
それ以外の環境ではdotnetツールとしてインストールできます。

```console
dotnet tool install --global fsautocomplete
```

## インストール

このプラグインをインストールする前に、
[ncaq/konoka](../../README.md)マーケットプレイスをClaude Codeに追加してください。

Claude Codeで以下を実行します。

```text
/plugin install fsharp-lsp@konoka
```

または`.claude/settings.json`に追加します。

```json
{
  "enabledPlugins": {
    "fsharp-lsp@konoka": true
  }
}
```

## 設定内容

- `--adaptive-lsp-server-enabled`:
  FSharp.Data.Adaptiveベースの新しいサーバ実装を使います。
  nvim-lspconfigの既定と同じです
- `AutomaticWorkspaceInit`:
  ワークスペース(fsprojの探索とロード)を接続時に自動で初期化します。
  汎用LSPクライアントはFSAC固有の`fsharp/workspaceLoad`を送らないため、
  これを有効にしないとプロジェクトが解決されず診断が不完全になります
- `UnusedOpensAnalyzer`・`UnusedDeclarationsAnalyzer`・`SimplifyNameAnalyzer`:
  FSAC組み込みの診断(未使用open・未使用宣言・冗長な修飾子)を有効にします。
  nvim-lspconfigが推奨設定として渡している値に合わせています

## ライセンス

Apache-2.0
