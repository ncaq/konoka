# commit

ステージ済みの変更からAIがコミットメッセージを生成し、
ユーザが確認してからコミットするClaude Codeプラグインです。

プロジェクト固有のコミットメッセージガイドラインの、
`.github/git-commit-instructions.md`にも対応しています。

## インストール

このプラグインをインストールする前に、
[ncaq/konoka](../../README.md)マーケットプレイスをClaude Codeに追加してください。

Claude Codeで以下を実行します。

```text
/plugin install commit@konoka
```

または`.claude/settings.json`に追加します。

```json
{
  "enabledPlugins": {
    "commit@konoka": true
  }
}
```

## 要件

- Node.js >= 22.19.0
- npm。Node.jsに同梱されているはずです。


## セットアップ

このプラグインは一時ファイルを`$XDG_RUNTIME_DIR/coding-agent-work/commit/`配下に、
タイムスタンプ付きのサブディレクトリを作成して保存します。
Claude Codeの自動承認ディレクトリに追加することを推奨します。

### 環境変数の確認

```bash
echo $XDG_RUNTIME_DIR
```

典型的なデフォルト値:

| ディストリビューション                     | パス                           |
| ------------------------------------------ | ------------------------------ |
| systemd搭載Linux (NixOS, Ubuntu, Fedora等) | `/run/user/<uid>`              |
| macOS                                      | 未設定(`/tmp`にフォールバック) |

### 自動承認ディレクトリの追加

`~/.claude/settings.json`に以下を追加してください。
`<uid>`は`id -u`の出力に置き換えてください。

```json
{
  "permissions": {
    "additionalDirectories": ["/run/user/<uid>/coding-agent-work/"]
  }
}
```

現時点ではClaude Codeの`additionalDirectories`は環境変数を展開しないため、
絶対パスで指定する必要があります。

`$XDG_RUNTIME_DIR`が未設定の環境では`/tmp`にフォールバックします。

## 使い方

Claude Codeで`/commit`スキルを呼び出してください。

### commit-styleスキル

`/commit`スキルとは別に、
commit-styleスキルが自動的に提供されます。
このスキルはユーザが直接呼び出すものではなく、
`/commit`以外の方法でコミットメッセージを書く際にも、
スタイルガイドラインが適用されるようにするためのものです。

commit-styleスキルは以下を行います。

- リポジトリの直近のコミット履歴からスタイルを把握する
- `.github/git-commit-instructions.md`があればプロジェクト固有のガイドラインを読み込む
- デフォルトのスタイルを適用する。
  以下はその一部です。
  - 丁寧語
  - 行長制限
  - シンボルのバッククォート囲み

## ライセンス

Apache-2.0
