---
name: pr-style
description: Pull request style guidelines covering title, body, assignee, and label selection. Use when writing or proposing GitHub pull requests, including direct `gh pr create` invocations outside the /pr skill.
allowed-tools: >-
  Bash(gh label list:*),
  Bash(gh pr list:*),
  Bash(gh pr view:*),
  Bash(git diff:*),
  Bash(git log:*),
  Bash(read-contributing:*),
  Bash(read-pull-request-template:*),
  Skill(commit:commit-style),
  mcp__github__actions_get,
  mcp__github__actions_list,
  mcp__github__custom_properties_read,
  mcp__github__find_duplicate,
  mcp__github__get_automation,
  mcp__github__get_automation_revision,
  mcp__github__get_automations_configuration_for_repository,
  mcp__github__get_code_quality_finding,
  mcp__github__get_code_scanning_alert,
  mcp__github__get_commit,
  mcp__github__get_copilot_space,
  mcp__github__get_dependabot_alert,
  mcp__github__get_discussion,
  mcp__github__get_discussion_comments,
  mcp__github__get_file_blame,
  mcp__github__get_file_contents,
  mcp__github__get_gist,
  mcp__github__get_global_security_advisory,
  mcp__github__get_job_logs,
  mcp__github__get_label,
  mcp__github__get_latest_release,
  mcp__github__get_me,
  mcp__github__get_notification_details,
  mcp__github__get_release_by_tag,
  mcp__github__get_repository_tree,
  mcp__github__get_secret_scanning_alert,
  mcp__github__get_tag,
  mcp__github__get_team_members,
  mcp__github__get_teams,
  mcp__github__github_support_docs_search,
  mcp__github__issue_artifact_read,
  mcp__github__issue_dependency_read,
  mcp__github__issue_read,
  mcp__github__list_automation_revisions,
  mcp__github__list_automations,
  mcp__github__list_available_automation_tools,
  mcp__github__list_available_automation_triggers,
  mcp__github__list_branches,
  mcp__github__list_code_scanning_alerts,
  mcp__github__list_commits,
  mcp__github__list_copilot_spaces,
  mcp__github__list_dependabot_alerts,
  mcp__github__list_discussion_categories,
  mcp__github__list_discussions,
  mcp__github__list_gists,
  mcp__github__list_global_security_advisories,
  mcp__github__list_issue_fields,
  mcp__github__list_issue_types,
  mcp__github__list_issues,
  mcp__github__list_label,
  mcp__github__list_notifications,
  mcp__github__list_org_repository_security_advisories,
  mcp__github__list_pull_requests,
  mcp__github__list_releases,
  mcp__github__list_repository_collaborators,
  mcp__github__list_repository_security_advisories,
  mcp__github__list_secret_scanning_alerts,
  mcp__github__list_starred_repositories,
  mcp__github__list_tags,
  mcp__github__projects_get,
  mcp__github__projects_list,
  mcp__github__pull_request_artifact_read,
  mcp__github__pull_request_read,
  mcp__github__repository_ruleset_read,
  mcp__github__search_code,
  mcp__github__search_commits,
  mcp__github__search_issues,
  mcp__github__search_orgs,
  mcp__github__search_pull_requests,
  mcp__github__search_repositories,
  mcp__github__search_users,
  mcp__github__ui_get,
  mcp__plugin_claude-code-home-manager_github__actions_get,
  mcp__plugin_claude-code-home-manager_github__actions_list,
  mcp__plugin_claude-code-home-manager_github__custom_properties_read,
  mcp__plugin_claude-code-home-manager_github__find_duplicate,
  mcp__plugin_claude-code-home-manager_github__get_automation,
  mcp__plugin_claude-code-home-manager_github__get_automation_revision,
  mcp__plugin_claude-code-home-manager_github__get_automations_configuration_for_repository,
  mcp__plugin_claude-code-home-manager_github__get_code_quality_finding,
  mcp__plugin_claude-code-home-manager_github__get_code_scanning_alert,
  mcp__plugin_claude-code-home-manager_github__get_commit,
  mcp__plugin_claude-code-home-manager_github__get_copilot_space,
  mcp__plugin_claude-code-home-manager_github__get_dependabot_alert,
  mcp__plugin_claude-code-home-manager_github__get_discussion,
  mcp__plugin_claude-code-home-manager_github__get_discussion_comments,
  mcp__plugin_claude-code-home-manager_github__get_file_blame,
  mcp__plugin_claude-code-home-manager_github__get_file_contents,
  mcp__plugin_claude-code-home-manager_github__get_gist,
  mcp__plugin_claude-code-home-manager_github__get_global_security_advisory,
  mcp__plugin_claude-code-home-manager_github__get_job_logs,
  mcp__plugin_claude-code-home-manager_github__get_label,
  mcp__plugin_claude-code-home-manager_github__get_latest_release,
  mcp__plugin_claude-code-home-manager_github__get_me,
  mcp__plugin_claude-code-home-manager_github__get_notification_details,
  mcp__plugin_claude-code-home-manager_github__get_release_by_tag,
  mcp__plugin_claude-code-home-manager_github__get_repository_tree,
  mcp__plugin_claude-code-home-manager_github__get_secret_scanning_alert,
  mcp__plugin_claude-code-home-manager_github__get_tag,
  mcp__plugin_claude-code-home-manager_github__get_team_members,
  mcp__plugin_claude-code-home-manager_github__get_teams,
  mcp__plugin_claude-code-home-manager_github__github_support_docs_search,
  mcp__plugin_claude-code-home-manager_github__issue_artifact_read,
  mcp__plugin_claude-code-home-manager_github__issue_dependency_read,
  mcp__plugin_claude-code-home-manager_github__issue_read,
  mcp__plugin_claude-code-home-manager_github__list_automation_revisions,
  mcp__plugin_claude-code-home-manager_github__list_automations,
  mcp__plugin_claude-code-home-manager_github__list_available_automation_tools,
  mcp__plugin_claude-code-home-manager_github__list_available_automation_triggers,
  mcp__plugin_claude-code-home-manager_github__list_branches,
  mcp__plugin_claude-code-home-manager_github__list_code_scanning_alerts,
  mcp__plugin_claude-code-home-manager_github__list_commits,
  mcp__plugin_claude-code-home-manager_github__list_copilot_spaces,
  mcp__plugin_claude-code-home-manager_github__list_dependabot_alerts,
  mcp__plugin_claude-code-home-manager_github__list_discussion_categories,
  mcp__plugin_claude-code-home-manager_github__list_discussions,
  mcp__plugin_claude-code-home-manager_github__list_gists,
  mcp__plugin_claude-code-home-manager_github__list_global_security_advisories,
  mcp__plugin_claude-code-home-manager_github__list_issue_fields,
  mcp__plugin_claude-code-home-manager_github__list_issue_types,
  mcp__plugin_claude-code-home-manager_github__list_issues,
  mcp__plugin_claude-code-home-manager_github__list_label,
  mcp__plugin_claude-code-home-manager_github__list_notifications,
  mcp__plugin_claude-code-home-manager_github__list_org_repository_security_advisories,
  mcp__plugin_claude-code-home-manager_github__list_pull_requests,
  mcp__plugin_claude-code-home-manager_github__list_releases,
  mcp__plugin_claude-code-home-manager_github__list_repository_collaborators,
  mcp__plugin_claude-code-home-manager_github__list_repository_security_advisories,
  mcp__plugin_claude-code-home-manager_github__list_secret_scanning_alerts,
  mcp__plugin_claude-code-home-manager_github__list_starred_repositories,
  mcp__plugin_claude-code-home-manager_github__list_tags,
  mcp__plugin_claude-code-home-manager_github__projects_get,
  mcp__plugin_claude-code-home-manager_github__projects_list,
  mcp__plugin_claude-code-home-manager_github__pull_request_artifact_read,
  mcp__plugin_claude-code-home-manager_github__pull_request_read,
  mcp__plugin_claude-code-home-manager_github__repository_ruleset_read,
  mcp__plugin_claude-code-home-manager_github__search_code,
  mcp__plugin_claude-code-home-manager_github__search_commits,
  mcp__plugin_claude-code-home-manager_github__search_issues,
  mcp__plugin_claude-code-home-manager_github__search_orgs,
  mcp__plugin_claude-code-home-manager_github__search_pull_requests,
  mcp__plugin_claude-code-home-manager_github__search_repositories,
  mcp__plugin_claude-code-home-manager_github__search_users,
  mcp__plugin_claude-code-home-manager_github__ui_get
user-invocable: false
effort: low
---

GitHubのpull requestを作成するときのスタイルガイドラインです。
タイトルと本文の書き方に加え、
アサインとラベルの決め方も扱います。
`/pr`スキル経由でないPR作成でも、
このガイドラインに従ってください。

# 大前提: そのリポジトリのスタイルに従う

リポジトリ固有のスタイルがある場合は、
ここに書かれたデフォルトより優先してください。

# 文章の共通規則

`Skill`ツールで`commit:commit-style`スキルを呼び出し、
文章の規則はそちらに従ってください。
プラグイン名を含めた完全修飾名(`commit:commit-style`)を指定してください。

PRのタイトルと本文はコミットメッセージと同じ`commit-msg`フックで検査されるため、
コミットメッセージと同じ規則が適用されます。
このスキルでは規則を繰り返さず、
以下を`commit-style`に委譲します。

- 言語
- 文体
- タイトルの長さと末尾の文字
- 行長と改行
- コードシンボル
- 列挙
- issueやPRの参照
- 使ってはいけないもの

`commit-style`はコミット履歴とプロジェクト固有のコミットメッセージガイドラインも読み込みます。
それらもPRのスタイルの参考にしてください。

# リポジトリ固有のCONTRIBUTING

!`read-contributing`

上記の内容が空でなければリポジトリの`CONTRIBUTING.md`の内容です。
`CONTRIBUTING.md`ファイルが典型的に存在する場所を探索して、
最初に見つかったファイルの内容を出力します。
内容に従ってください。

# リポジトリ固有のpull requestテンプレート

!`read-pull-request-template`

上記の内容が空でなければリポジトリのpull requestテンプレートです。
GitHub標準のテンプレートの置き場所を探索して、
全てのテンプレートの内容を出力します。

テンプレートが存在する場合は、
そのテンプレートの構造を本文に反映してください。
複数のテンプレートが存在する場合は、
PRの内容に最も合うものを選んでください。

# 過去のmerged PRの参照

直近のmergedなPRは、
タイトルと本文のスタイル、
そしてラベルの実際の使われ方の両方の参考になります。
GitHub MCPが利用可能な場合は優先して使ってください。
PR一覧の応答にはラベル情報も含まれているため、
この取得結果を後のラベル選定にも流用してください。

- `list_pull_requests`: PR一覧の取得
- `pull_request_read`: PR詳細の取得

GitHub MCPが使えない場合はGitHub CLI(`gh`)を使ってください。

```bash
gh pr list --state merged --limit 20 --json number,title,body,author,labels
gh pr view <number> --json title,body,labels
```

bot(renovateやdependabotなど)のPRは参考になりません。
`author.is_bot`が`false`のPRだけを参考にしてください。

# コミット履歴とdiffの把握

baseブランチからの差分を以下のコマンドで取得してください。

```bash
git log <base>..HEAD --no-merges
git diff <base>...HEAD --stat
```

差分が大きい場合は`--stat`で概要を把握してから、
必要な範囲だけ`git diff`本体で内容を確認してください。

# タイトルのスタイル

リポジトリのスタイルが不明な場合のデフォルトスタイルは、
`commit-style`スキルのガイドラインに従った、
Conventional Commits準拠の日本語タイトルです。
文字数の上限や末尾の文字の規則も`commit-style`に従ってください。

リポジトリのスタイルがある場合はそちらを優先してください。

PRに含まれるコミットが1つだけの場合は、
そのコミットのタイトルをそのままPRのタイトルに使ってください。

PRに含まれるコミットが複数ある場合は、
PR全体の変更を要約するタイトルを新たに書いてください。

# 本文のスタイル

リポジトリ固有のテンプレートが用意されている場合は、
そのテンプレートを埋める形で本文を書いてください。

テンプレートがない場合の文章の規則は`commit-style`に従ってください。

## 1コミットPR

PRに含まれるコミットが1つだけの場合は、
そのコミットメッセージの本文をそのままPRの本文に使ってください。

## 複数コミットPR

PRに含まれるコミットが複数ある場合は、
PR全体の変更を要約する本文を新たに書いてください。

要約は投稿時点のスナップショットを意識してください。
「最初は〜という実装だったが、〜に変えた」のような中間地点の情報は不要です。
最終的にこのPRがmergeされたら何が達成されるのかを書いてください。

実装の具体的詳細はPR提出後の修正で変わる可能性が高いです。

よって具体的な関数名やファイル名の羅列ではなく、
何故この変更が必要なのか、
これをマージすることで何を達成するのか、
という抽象的な記述を優先してください。

# アサインの決定

GitHub MCPの`get_me`で認証済みユーザの情報を取得し、
`login`を記憶してください。
PRのアサインは基本的にこの自分自身を表すユーザ名を指定します。

# ラベルの選定

!`gh label list --json name,description,color --limit 100`

上の埋め込みコマンドの結果はリポジトリで定義されているラベル一覧です。

GitHub MCPの`list_label`はデフォルトのtoolsetに含まれず、
使えない環境が多いため、
ここだけGitHub CLIを使っています。

存在しないラベルを指定するとアサインとラベルの一括設定ステップが失敗するため、
ここから外れたラベルは付与しないでください。

その上で「過去のmerged PRの参照」で取得したPRで、
どのようなラベルが付与されているかも参考にしてください。
ラベルの定義名だけでは用途の温度感が分からないため、
実際の使われ方を観察することで適切な選定ができます。

PRの内容を考慮して、
取得したラベル一覧から適切なものを選んでください。
適切なラベルが見当たらない場合はラベルなしで構いません。
