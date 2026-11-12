---
name: survey
description: Internal skill for the `/research` skill. Use when dispatched from the `/research` skill with a single subquery. Do NOT invoke directly; use the `/research` skill instead.
user-invocable: false
context: fork
agent: general-purpose
background: true
allowed-tools: >-
  Glob,
  Grep,
  Read,
  WebFetch,
  WebSearch,
  mcp__backlog__count_issues,
  mcp__backlog__count_notifications,
  mcp__backlog__get_categories,
  mcp__backlog__get_custom_fields,
  mcp__backlog__get_document,
  mcp__backlog__get_document_tree,
  mcp__backlog__get_documents,
  mcp__backlog__get_git_repositories,
  mcp__backlog__get_git_repository,
  mcp__backlog__get_issue,
  mcp__backlog__get_issue_comments,
  mcp__backlog__get_issue_types,
  mcp__backlog__get_issues,
  mcp__backlog__get_myself,
  mcp__backlog__get_notifications,
  mcp__backlog__get_priorities,
  mcp__backlog__get_project,
  mcp__backlog__get_project_list,
  mcp__backlog__get_pull_request,
  mcp__backlog__get_pull_request_comments,
  mcp__backlog__get_pull_requests,
  mcp__backlog__get_pull_requests_count,
  mcp__backlog__get_resolutions,
  mcp__backlog__get_space,
  mcp__backlog__get_users,
  mcp__backlog__get_version_milestone_list,
  mcp__backlog__get_watching_list_count,
  mcp__backlog__get_watching_list_items,
  mcp__backlog__get_wiki,
  mcp__backlog__get_wiki_pages,
  mcp__backlog__get_wikis_count,
  mcp__plugin_claude-code-home-manager_backlog__count_issues,
  mcp__plugin_claude-code-home-manager_backlog__count_notifications,
  mcp__plugin_claude-code-home-manager_backlog__get_categories,
  mcp__plugin_claude-code-home-manager_backlog__get_custom_fields,
  mcp__plugin_claude-code-home-manager_backlog__get_document,
  mcp__plugin_claude-code-home-manager_backlog__get_document_tree,
  mcp__plugin_claude-code-home-manager_backlog__get_documents,
  mcp__plugin_claude-code-home-manager_backlog__get_git_repositories,
  mcp__plugin_claude-code-home-manager_backlog__get_git_repository,
  mcp__plugin_claude-code-home-manager_backlog__get_issue,
  mcp__plugin_claude-code-home-manager_backlog__get_issue_comments,
  mcp__plugin_claude-code-home-manager_backlog__get_issue_types,
  mcp__plugin_claude-code-home-manager_backlog__get_issues,
  mcp__plugin_claude-code-home-manager_backlog__get_myself,
  mcp__plugin_claude-code-home-manager_backlog__get_notifications,
  mcp__plugin_claude-code-home-manager_backlog__get_priorities,
  mcp__plugin_claude-code-home-manager_backlog__get_project,
  mcp__plugin_claude-code-home-manager_backlog__get_project_list,
  mcp__plugin_claude-code-home-manager_backlog__get_pull_request,
  mcp__plugin_claude-code-home-manager_backlog__get_pull_request_comments,
  mcp__plugin_claude-code-home-manager_backlog__get_pull_requests,
  mcp__plugin_claude-code-home-manager_backlog__get_pull_requests_count,
  mcp__plugin_claude-code-home-manager_backlog__get_resolutions,
  mcp__plugin_claude-code-home-manager_backlog__get_space,
  mcp__plugin_claude-code-home-manager_backlog__get_users,
  mcp__plugin_claude-code-home-manager_backlog__get_version_milestone_list,
  mcp__plugin_claude-code-home-manager_backlog__get_watching_list_count,
  mcp__plugin_claude-code-home-manager_backlog__get_watching_list_items,
  mcp__plugin_claude-code-home-manager_backlog__get_wiki,
  mcp__plugin_claude-code-home-manager_backlog__get_wiki_pages,
  mcp__plugin_claude-code-home-manager_backlog__get_wikis_count,
  mcp__plugin_claude-code-home-manager_cloudflare__docs,
  mcp__plugin_claude-code-home-manager_cloudflare__search,
  mcp__plugin_claude-code-home-manager_context7__query-docs,
  mcp__plugin_claude-code-home-manager_context7__resolve-library-id,
  mcp__plugin_claude-code-home-manager_deepwiki__ask_wiki_question,
  mcp__plugin_claude-code-home-manager_deepwiki__read_wiki_contents,
  mcp__plugin_claude-code-home-manager_deepwiki__read_wiki_structure,
  mcp__github__actions_get,
  mcp__github__actions_list,
  mcp__github__get_code_scanning_alert,
  mcp__github__get_commit,
  mcp__github__get_dependabot_alert,
  mcp__github__get_discussion,
  mcp__github__get_discussion_comments,
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
  mcp__github__issue_read,
  mcp__github__list_branches,
  mcp__github__list_code_scanning_alerts,
  mcp__github__list_commits,
  mcp__github__list_dependabot_alerts,
  mcp__github__list_discussion_categories,
  mcp__github__list_discussions,
  mcp__github__list_gists,
  mcp__github__list_global_security_advisories,
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
  mcp__github__pull_request_read,
  mcp__github__search_code,
  mcp__github__search_commits,
  mcp__github__search_issues,
  mcp__github__search_orgs,
  mcp__github__search_pull_requests,
  mcp__github__search_repositories,
  mcp__github__search_users,
  mcp__plugin_claude-code-home-manager_github__actions_get,
  mcp__plugin_claude-code-home-manager_github__actions_list,
  mcp__plugin_claude-code-home-manager_github__get_code_scanning_alert,
  mcp__plugin_claude-code-home-manager_github__get_commit,
  mcp__plugin_claude-code-home-manager_github__get_dependabot_alert,
  mcp__plugin_claude-code-home-manager_github__get_discussion,
  mcp__plugin_claude-code-home-manager_github__get_discussion_comments,
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
  mcp__plugin_claude-code-home-manager_github__issue_read,
  mcp__plugin_claude-code-home-manager_github__list_branches,
  mcp__plugin_claude-code-home-manager_github__list_code_scanning_alerts,
  mcp__plugin_claude-code-home-manager_github__list_commits,
  mcp__plugin_claude-code-home-manager_github__list_dependabot_alerts,
  mcp__plugin_claude-code-home-manager_github__list_discussion_categories,
  mcp__plugin_claude-code-home-manager_github__list_discussions,
  mcp__plugin_claude-code-home-manager_github__list_gists,
  mcp__plugin_claude-code-home-manager_github__list_global_security_advisories,
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
  mcp__plugin_claude-code-home-manager_github__pull_request_read,
  mcp__plugin_claude-code-home-manager_github__search_code,
  mcp__plugin_claude-code-home-manager_github__search_commits,
  mcp__plugin_claude-code-home-manager_github__search_issues,
  mcp__plugin_claude-code-home-manager_github__search_orgs,
  mcp__plugin_claude-code-home-manager_github__search_pull_requests,
  mcp__plugin_claude-code-home-manager_github__search_repositories,
  mcp__plugin_claude-code-home-manager_github__search_users,
  mcp__plugin_claude-code-home-manager_mdn__get-compat,
  mcp__plugin_claude-code-home-manager_mdn__get-doc,
  mcp__plugin_claude-code-home-manager_mdn__search,
  mcp__plugin_claude-code-home-manager_microsoft-learn__microsoft_code_sample_search,
  mcp__plugin_claude-code-home-manager_microsoft-learn__microsoft_docs_fetch,
  mcp__plugin_claude-code-home-manager_microsoft-learn__microsoft_docs_search,
  mcp__plugin_claude-code-home-manager_nixos__nix,
  mcp__plugin_claude-code-home-manager_nixos__nix_versions,
  mcp__plugin_nix-tasuke_nixos__nix,
  mcp__plugin_nix-tasuke_nixos__nix_versions,
  mcp__plugin_research_cloudflare__migrate_pages_to_workers_guide,
  mcp__plugin_research_cloudflare__search_cloudflare_documentation,
  mcp__plugin_research_context7__query-docs,
  mcp__plugin_research_context7__resolve-library-id,
  mcp__plugin_research_deepwiki__ask_wiki_question,
  mcp__plugin_research_deepwiki__read_wiki_contents,
  mcp__plugin_research_deepwiki__read_wiki_structure,
  mcp__plugin_research_mdn__get-compat,
  mcp__plugin_research_mdn__get-doc,
  mcp__plugin_research_mdn__search,
  mcp__plugin_research_microsoft-learn__microsoft_code_sample_search,
  mcp__plugin_research_microsoft-learn__microsoft_docs_fetch,
  mcp__plugin_research_microsoft-learn__microsoft_docs_search
model: sonnet
effort: low
---

あらゆる情報ソースを横断検索して回答します。

# 調査クエリ

$ARGUMENTS

# 利用可能なソース

- Web
  - 一般的なWeb検索(WebSearch)
  - 任意のURL取得(WebFetch)
- ドキュメント
  - [Cloudflare Docs](https://developers.cloudflare.com/)(MCP)
  - [Context7(ライブラリの最新ドキュメント)](https://context7.com/)(MCP)
  - [Hackage](https://hackage.haskell.org/)(WebFetch)
  - [MDN](https://developer.mozilla.org/)(MCP)
  - [Microsoft Learn](https://learn.microsoft.com/)(MCP)
- Nix
  - [nixpkgs](https://github.com/NixOS/nixpkgs)(MCP)
  - [home-manager](https://github.com/nix-community/home-manager)(MCP)
  - [flakes](https://wiki.nixos.org/wiki/Flakes/ja)(MCP)
- リポジトリ
  - [GitHub(コード検索、Issue/PR確認)](https://github.com/)(MCP)
  - [DeepWiki](https://deepwiki.com/)(MCP)
- プロジェクト管理
  - [Backlog(課題、Wiki、PR)](https://backlog.com/)(MCP)

# 検索戦略

1. 質問の種類を判断し適切なソースを選択
2. ライブラリの問題調査時はGitHub Issue/PRを確認
3. 複数ソースから情報を収集して統合

# 実行方針

- 情報の網羅性と根拠の数を保つ
- 深い推論、長い検討、仮説の掘り下げは避ける
- 独立した検索を進め、得られた事実をそのまま報告する
- 情報源間に矛盾がある場合だけ、原因を簡潔に確認する
- 推測で補完せず、確証のない点は不明として明記する
- 各ソースの取得後に再計画せず、必要な検索を完了したら直ちに報告する

# 出力

- 情報源を明記
- 関連URLを提示
