# misuzu

PRに対するレビューへの対応を半自動化するClaude Codeプラグインです。

PRについている全てのレビュー・コメント・スレッドのresolved状態を取得し、
指摘への対応を論理単位に分割して、
1単位ずつ修正とコミットを繰り返します。
全ての対応が終わったらレビューコメントに返信し、
解決したスレッドをresolveします。

## インストール

このプラグインをインストールする前に、
[ncaq/konoka](../../README.md)マーケットプレイスをClaude Codeに追加してください。

Claude Codeで以下を実行します。

```text
/plugin install misuzu@konoka
```

または`.claude/settings.json`に追加します。

```json
{
  "enabledPlugins": {
    "misuzu@konoka": true
  }
}
```

## 要件

- `Node.js >= 22.22.2`
- npm。Node.jsに同梱されているはずです。
- GitHubのトークン。
  環境変数(`GH_TOKEN`, `GITHUB_TOKEN`等)か、
  認証済みの[GitHub CLI(`gh`)](https://cli.github.com/)から取得します。
- スレッドのresolveには対象リポジトリへのpush権限が必要です。

[commit](../commit)プラグインに依存しています。
コミットはcommitスキル経由で行われます。

## セットアップ

このプラグインは一時ファイルを`$XDG_RUNTIME_DIR/coding-agent-work/misuzu/`配下に、
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

Claude Codeで`/misuzu`スキルを呼び出してください。

```text
/misuzu https://github.com/owner/repo/pull/123
```

引数にはPRのURLの他に、
レビューやレビューコメントのURL(`#pullrequestreview-<id>`等のフラグメント付きURL)も指定できます。
その場合はそのレビューやコメントを優先して対応します。

引数を省略するとカレントブランチからPRを推定します。
PRが特定できない場合はローカルモードになり、
会話コンテキスト中の指摘(kyoseiのローカルレビュー出力など)を対象に、
GitHubへの返信を除いた修正とコミットのみを行います。

スキルは以下のフローで動作します。

1. PRの全てのコメント・レビュー・スレッド(resolved状態を含む)を取得します。
2. 指摘への対応を、ファイル単位ではなく修正意図単位の論理単位に分割します。
3. planモードで対応計画を提示し、ユーザの承認を得ます。
4. 1単位ずつ修正してコミットします。
   テスト追加とバグ修正を伴う単位はテストファーストで、
   失敗するテストのコミットと修正のコミットに分けます。
5. 全体が壊れていないか軽く検証します。
6. 各スレッドへの返信を組み立ててユーザが確認してから投稿し、
   解決したスレッドをresolveします。

このスキルはpushを行いません。
返信中のコミットへのリンクはpushされるまで404になります。
pushはユーザが自分のタイミングで行ってください。

## ライセンス

Apache-2.0

kyoseiプラグイン由来のコードを含みます。
詳細は[NOTICE](./NOTICE)を参照してください。
