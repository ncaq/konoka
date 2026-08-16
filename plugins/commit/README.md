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

- `Node.js >= 22.22.2`
- npm。Node.jsに同梱されているはずです。
- [delta](https://github.com/dandavison/delta)。任意ですが推奨します。
  ステージされた差分をシンタックスハイライト付きで表示するのに使います。
  無い場合はハイライト無しの素のパッチ表示にフォールバックします。
  home-managerモジュールなどのNixビルドを経由して導入した場合は自動的に同梱されます。
  非TTYでの実行になるためdeltaの背景色の自動検出は働かずダーク既定になります。
  gitの設定の`[delta]`セクション(`light = true`や`syntax-theme`など)はそのまま尊重されます。
  適用されている設定は`git config list`の`delta.`から始まる項目で確認できます。
  なお2026年8月時点のClaudeのAndroidアプリはBashツール出力のANSIエスケープシーケンスを解釈しないため、
  モバイルアプリからセッションを閲覧すると差分が制御コード混じりの崩れた表示になります。
  ハイライト表示はターミナルでの利用を想定した機能です。

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

### commit-msgフックによる検査

生成したコミットメッセージは、
ユーザに確認してもらう前に`commit-msg`フックで検査します。

`git commit`が起動するのと同じフックを同じ方法で起動するため、
グローバル設定の`core.hooksPath`のフックも、
作業中のリポジトリのフックも対象になります。
commitlintなどをフックとして設定していれば、
その指摘をAIがメッセージ生成の直後に受け取って修正できます。

コミットの実行時に弾かれてやり直すより手戻りが少なく済みます。

フックを設定していない場合は何も検査せずに次へ進みます。

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
