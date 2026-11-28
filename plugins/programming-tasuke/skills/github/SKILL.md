---
name: github
description: How to access GitHub. Avoid direct URL fetches; prefer GitHub MCP tools or the `gh` CLI subcommands. Use when fetching GitHub information or operating on issues, pull requests, or workflows.
user-invocable: false
---

# GitHubへのアクセス方法

GitHubの情報の取得や操作には、GitHub MCPが利用できる場合はそれを優先して使い、
利用できない場合はGitHub CLI(`gh`)を使ってください。

GitHubのURLを`WebFetch`などで直接取得することは避けます。
プライベートリポジトリにはアクセスできず、
HTMLページは構造化されていないので扱いにくく、
レート制限にも引っかかりやすいためです。

## GitHub MCP

ツール名のプレフィクスは、MCPサーバの登録方法によって異なります。
ユーザ設定で直接登録している場合は`mcp__github__`、
プラグイン経由で登録している場合は`mcp__plugin_<プラグイン名>_github__`
(例: `mcp__plugin_claude-code-home-manager_github__`)で始まります。

主なツールは、`get_file_contents`、`issue_read`、`pull_request_read`、
`search_code`、`search_issues`、`list_commits`です。
`pull_request_read`は、methodに`get_check_runs`を指定すると、
GitHub Actionsのビルドやチェックの結果を確認できます。

## GitHub CLI

`gh repo`、`gh issue`、`gh pr`、`gh release`、`gh run`、`gh workflow`のような、
専用のサブコマンドを使います。

```console
gh pr view 456 --repo owner/repo
gh run view RUN_ID --repo owner/repo --log-failed
```

GitHub Actionsの実行ログは`gh run view`の`--log`で表示できます。
`--log-failed`にすると、失敗したジョブのログだけになります。

`gh api`は低レベルすぎるので非推奨です。
人間が承認するときに何が実行されるのかを理解しにくく、
エンドポイントの知識も必要になります。
多くの場合は、専用のサブコマンドで同じことができます。
