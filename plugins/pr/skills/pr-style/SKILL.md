---
name: pr-style
description: Pull request style guidelines covering title, body, assignee, and label selection. Use when writing or proposing GitHub pull requests, including direct `gh pr create` invocations outside the /pr skill.
allowed-tools: Bash(gh label list:*), Bash(gh pr list:*), Bash(gh pr view:*), Bash(gh repo view:*), Bash(git diff:*), Bash(git log:*), Bash(read-contributing:*), Bash(read-pull-request-template:*), Skill(commit:commit-style), mcp__github__get_me, mcp__github__list_pull_requests, mcp__github__pull_request_read
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

- `mcp__github__list_pull_requests`: PR一覧の取得
- `mcp__github__pull_request_read`: PR詳細の取得

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

`mcp__github__get_me`で認証済みユーザの情報を取得し、
`login`を記憶してください。
PRのアサインは基本的にこの自分自身を表すユーザ名を指定します。

# ラベルの選定

!`gh label list --json name,description,color --limit 100`

上の埋め込みコマンドの結果はリポジトリで定義されているラベル一覧です。

GitHub MCPにラベル一覧を取得するツールはないため、
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
