# pr

現在のブランチからAIがGitHub pull requestのタイトルと本文を生成し、
ユーザが確認してから作成するClaude Codeプラグインです。

以下のリポジトリ固有のファイルを実行時に読み込んでスタイルに反映します。

- `CONTRIBUTING.md`
- `pull_request_template.md`

## インストール

このプラグインをインストールする前に、
[ncaq/konoka](../../README.md)マーケットプレイスをClaude Codeに追加してください。

Claude Codeで以下を実行します。

```text
/plugin install pr@konoka
```

または`.claude/settings.json`に追加します。

```json
{
  "enabledPlugins": {
    "pr@konoka": true
  }
}
```

## 要件

- `Node.js >= 22.22.2`
- npm。Node.jsに同梱されているはずです。
- [GitHub CLI(`gh`)](https://cli.github.com/) (`gh repo view`、`gh label list`で使用)
- 認証済みのGitHub MCPサーバ (PR作成、アサイン、ラベル設定で利用)
- リモートにブランチをpushできるgit設定

## セットアップ

このプラグインは一時ファイルを`$XDG_RUNTIME_DIR/coding-agent-work/pr/`配下に、
サブディレクトリを作成して保存します。
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

Claude Codeで`/pr`スキルを呼び出してください。

スキルは以下のフローで動作します。

1. baseブランチを最新化し、必要に応じて現在のブランチをrebaseします。
2. 現在のブランチをremoteへpushします。
   PR作成前なのでrebase後はforce-with-leaseで安全に上書きできます。
3. リポジトリの`CONTRIBUTING.md`と`pull_request_template.md`を読み込み、
   過去のmerged PRも参考にしてタイトルと本文を生成します。
4. ユーザが内容を確認します。
   必要なら`$EDITOR`で本文を編集できます。
5. PRを作成し、自分自身をアサインして適切なラベルを付与します。

このスキルは新規作成のみを扱います。
既存PRの更新は対象外です。

### pr-styleスキル

`/pr`スキルとは別に、
pr-styleスキルが自動的に提供されます。
このスキルはユーザが直接呼び出すものではなく、
`/pr`以外の方法でPRを作成する際にも、
スタイルガイドラインが適用されるようにするためのものです。

pr-styleスキルは以下を行います。

- リポジトリの`CONTRIBUTING.md`を読み込む
- リポジトリの`pull_request_template.md`を読み込む
- 過去のmerged PRからタイトルと本文の傾向を把握する
- デフォルトのスタイルを適用する。
  以下の要素はその一部です。
  - 言語
  - 行長
  - 強調シンタックス
  - 絵文字や全角形の禁則
  - issueへの関連付け方

## ライセンス

Apache-2.0
