---
name: pr
description: Generate a GitHub pull request title and body from the current branch, then let the user review before creation in manual mode or create it without confirmation in auto mode. Use when the user wants to create a pull request.
argument-hint: "[manual|auto] [base]"
allowed-tools: >-
  Bash(konoka-pr-editor:*),
  Bash(prepare-editmsg:*),
  Bash(run-commit-msg-hook:*),
  Bash(sync-and-push:*),
  Edit,
  Read,
  Skill(pr:pr-style),
  Write,
  mcp__github__actions_get,
  mcp__github__actions_list,
  mcp__github__create_pull_request,
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
  mcp__github__issue_write,
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
  mcp__plugin_claude-code-home-manager_github__create_pull_request,
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
  mcp__plugin_claude-code-home-manager_github__issue_write,
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
effort: low
---

GitHubのpull requestを新しく作成します。
タイトルと本文を生成し、
`manual`確認モードではユーザの確認を取ってから作成し、
`auto`確認モードでは確認を取らずにそのまま作成します。
既存のPRの更新は扱いません。

# 同期とpushの結果

このスキルが読み込まれた時点で、補助コマンドの`sync-and-push`は実行済みです。
baseブランチをfetchし、
必要なら現在のブランチをその上にrebaseして、
`origin`へpushしています。
以下がその出力です。

!`sync-and-push $ARGUMENTS`

成功していれば、以下の8つのキーが`key=value`の形で1行ずつ出力されています。

- `current`: 現在のブランチです。
- `head`: PRの作成で`head`に渡す値です。
  `origin`のownerがPR先のリポジトリのownerと異なる場合、
  つまりforkからのPRの場合は`<originのowner>:<current>`の形になり、
  それ以外の場合は`current`と同じです。
- `base`: baseブランチです。
  引数で指定されていなければ、PR先のリポジトリのデフォルトブランチです。
- `owner`と`repo`: PR先のリポジトリです。
- `rebased`: 現在のブランチをbaseブランチの上にrebaseしたかを、`true`か`false`で表します。
- `action`: 行ったpushの種類です。
  `none`はpushが不要だったこと、
  `initial`は初回のpush、
  `normal`は通常のpush、
  `force`は`--force-with-lease`による上書きを表します。
- `commits`: PRに含まれるコミットの数です。

## 失敗していた場合

8つのキーが揃っていない場合は、`sync-and-push`が失敗しています。
エラーメッセージが出力されていればそのままユーザに報告し、
PRを作成せずに終了してください。
キーの値を推測で補って続行したり、
自分で`git rebase`や`git push`を実行してやり直したりはしません。
`sync-and-push`は安全に進められない状態を検出して止まっているので、
自分で続行すると既存のPRのブランチを上書きする恐れがあるためです。

以下のエラーは、補足を添えて報告します。

- `Failed to rebase`で始まるエラー: rebaseがコンフリクトなどで失敗しました。
  `git rebase --abort`で巻き戻し済みなので、ブランチはrebaseの前の状態です。
- `Command failed: git rebase --abort`で始まるエラー:
  未コミットの変更が残っているなどの理由で、rebaseを開始できませんでした。
- `An open pull request`で始まるエラー:
  force pushが必要な状態で、現在のブランチをheadとするopen PRが既にありました。
  force pushは行われていません。
  このスキルは新規作成だけを扱うので、既存のPRを更新するようユーザに促してください。
  baseブランチが進んでいた場合は、ローカルのブランチがrebaseされた状態のまま残っているので、
  そのことも伝えます。

# 確認モード

このスキルに渡された引数は`$ARGUMENTS`です。
引数には確認モードとbaseブランチが順不同で並び、どちらも省略できます。

引数を空白で分割したトークンのうち、
`manual`または`auto`と完全に一致するものだけが確認モードの指定です。
それ以外のトークンはbaseブランチの指定で、
`sync-and-push`が処理済みなので解釈する必要はありません。
部分一致では判定しません。
`auto-update`のようなbaseブランチ名を`auto`と取り違えると、確認が省略されてしまうためです。

- `manual`が指定されている場合は、`commits`の値に関係なく`manual`です。
  `auto`も同時に指定されている場合も`manual`として扱い、
  そう判断したことを完了報告で伝えます。
- `auto`だけが指定されている場合は`auto`です。
- どちらも指定されていない場合は、`commits`が`1`なら`auto`、それ以外なら`manual`です。
  コミットが1つだけのPRは、そのコミットメッセージをそのままタイトルと本文に使うので、
  コミットのときに確認した内容を改めて確認する必要がないためです。

# PR内容の準備

`Skill`ツールで`pr:pr-style`スキルを呼び出し、
そのガイドラインに従って、
コミット履歴とdiffの把握、タイトルと本文の生成、アサインとラベルの決定を済ませてください。
リポジトリ固有のCONTRIBUTINGとpull requestテンプレートは`pr-style`が読み込むので、
このスキルで改めて読み込む必要はありません。

baseブランチは、
PR先のリポジトリ(`owner`/`repo`)を指すremoteのremote追跡ブランチへfetchされていて、
ローカルのbaseブランチは更新されていません。
コミット履歴とdiffは、このremote追跡ブランチ`<remote>/<base>`と比較してください。
`<remote>`は、`head`が`current`と同じ場合は通常`origin`です。
異なる場合はforkからのPRなので、
`git remote -v`でURLが`owner`/`repo`を指すremoteの名前を確かめます。

# 一時ファイルへの書き出し

以下は、このスキルが読み込まれた時点で`prepare-editmsg`が出力した、
`PULLREQ_EDITMSG`ファイルの絶対パスです。
セッション固有の一時ディレクトリだけが作成済みで、ファイルはまだありません。

!`prepare-editmsg`

このパスに`Write`ツールで、
1行目をタイトル、空行を挟んで本文、という構造で書き出してください。

# タイトルと本文の検査

書き出したら、`commit`プラグインが提供する以下のコマンドで検査してください。

```bash
run-commit-msg-hook <PULLREQ_EDITMSGのパス>
```

`git commit`が起動するのと同じ`commit-msg`フックで、
`PULLREQ_EDITMSG`をコミットメッセージとして検査します。
フックが設定されていない場合は、何も検査せずに成功します。

コマンドが失敗した場合は、
出力された指摘に従ってタイトルと本文を修正し、再実行してください。
ただし以下の場合は修正を続けず、指摘の内容をユーザに報告して指示を仰ぎます。

- リポジトリのpull requestテンプレートに由来する部分への指摘のように、
  PRとして必要な内容を壊さないと直せない場合。
- 3回修正しても検査を通らない場合。

`auto`確認モードでも、検査を通っていない内容ではPRを作成しません。

フックはファイルを書き換えることがあるので、
検査を通ったら`Read`ツールでファイルを読み直し、
以降はその内容をタイトルと本文として使ってください。

# ユーザによる確認

`manual`確認モードの場合だけ行います。

`AskUserQuestion`ツールで、この内容でPRを作成してよいかを確認してください。
質問文には、タイトルと本文の全文、アサインするユーザ、付与するラベルを含めます。
ユーザが内容を見て判断できるように、本文が長くても省略や要約はしません。

選択肢は以下の2つです。

- このまま作成する(Recommended): 生成した内容で作成します。
- テキストエディタで編集する: エディタで編集してから作成します。

「このまま作成する」が選ばれた場合は、`PULLREQ_EDITMSG`の内容のままPRの作成へ進みます。

`Other`の自由入力で修正を指示された場合は、
指示に従って内容を修正し、もう一度確認を取ります。
タイトルと本文の修正は`PULLREQ_EDITMSG`に反映します。

質問がキャンセルされた場合は、PRの作成をやめるという意思表示として扱い、
PRを作成せずに終了します。

## テキストエディタで編集する場合

以下のコマンドを実行して、ユーザに編集してもらいます。
編集の途中で打ち切られないように、タイムアウトは最大の600秒にします。

```bash
konoka-pr-editor <PULLREQ_EDITMSGのパス>
```

コマンドが正常に終了したら、
`Read`ツールでファイルを読み直し、その内容でPRの作成へ進みます。
コマンドが異常終了した場合は、PRの作成をやめるという意思表示として扱い、
PRを作成せずに終了します。

# 内容の提示

`auto`確認モードの場合だけ行います。

タイトルと本文の全文、アサインするユーザ、付与するラベルを、
テキストメッセージとして出力してください。
本文が長くても省略や要約はしません。
確認を取らない場合も、`manual`確認モードと同じく作成の直前に内容が目に入るようにするためです。

`AskUserQuestion`ツールは呼ばず、ユーザの応答を待たずにPRの作成へ進みます。

# PRの作成

GitHub MCPの`create_pull_request`でPRを作成してください。

- `owner`、`repo`、`head`、`base`: `sync-and-push`の出力の同じ名前のキーの値です。
  forkからのPRでは`head`が`current`と異なるので、`head`を`current`で代用しません。
- `title`: `PULLREQ_EDITMSG`の1行目です。
- `body`: `PULLREQ_EDITMSG`の空行より後の本文です。
- `maintainer_can_modify`: `true`にします。
  forkからのPRでも、maintainerがブランチを直接修正できるようにするためです。
- `draft`: ユーザが明示的に指示した場合だけ`true`にし、それ以外は省略します。

organizationが所有するforkからのPRなど、
`maintainer_can_modify`が原因で作成に失敗した場合は、
`maintainer_can_modify`を省略して作成し直してください。

返ってきたPRの番号とURLを、以降で使います。

# アサインとラベルの設定

PRを作成するAPIはアサインとラベルを同時に設定できないので、
作成の直後にGitHub MCPの`issue_write`で設定します。
アサインとラベルが付いていない時間を短くするために、
PRの作成との間に他の処理を挟まず、1回の呼び出しで両方を設定してください。
アサインとラベルは、PR内容の準備で決めたものを使います。

- `method`: `"update"`
- `owner`、`repo`: `sync-and-push`の出力の同じ名前のキーの値です。
- `issue_number`: 作成したPRの番号です。
- `assignees`: アサインするユーザのloginの配列です。
- `labels`: 付与するラベルの配列です。付与するラベルが無ければ省略します。

他人のリポジトリへのPRなどでは、権限が足りずにこの設定が失敗することがあります。
その場合もPRは作成済みなので、作成し直さず、
PRは作成できたがアサインやラベルを設定できなかったことを報告してください。

# 完了報告

PRのURL、アサインしたユーザ、付与したラベルを報告してください。
タイトルと本文は作成の前に提示済みなので、全文を繰り返す必要はありません。
