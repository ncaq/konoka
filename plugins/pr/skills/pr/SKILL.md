---
name: pr
description: Generate a GitHub pull request title and body from the current branch and let the user review before creation. Use when the user wants to create a pull request.
allowed-tools: AskUserQuestion, Bash(editor:*), Bash(gh label list:*), Bash(git diff:*), Bash(git log:*), Bash(git push:*), Bash(git rev-list:*), Bash(git rev-parse:*), Bash(git status:*), Bash(prepare-editmsg.ts:*), Bash(sync-base.ts:*), Edit, Read, Skill(pr-style), Write, mcp__github__create_pull_request, mcp__github__get_me, mcp__github__issue_write, mcp__github__list_pull_requests, mcp__github__pull_request_read
---

GitHubのpull requestを作成します。
AIがタイトルと本文を生成し、
ユーザが確認してから作成します。
このスキルは新規作成のみを扱います。
既存PRの更新は対象外です。

# スタイルガイドラインの適用

`Skill`ツールで`pr-style`スキルを呼び出し、
スタイルガイドラインに従ってください。

このスキルがリポジトリ固有のCONTRIBUTINGとpull requestテンプレートも読み込むため、
このスキル内で改めて読み込む必要はありません。

# baseブランチとの同期

以下のコマンドでbaseブランチを最新化し、
必要に応じて現在のブランチをrebaseしてください。

!`sync-base.ts`

このスクリプトは以下を行います。

- 現在のブランチがbaseブランチでないことを確認します。
- baseブランチに切り替えてpullし、元のブランチに戻ります。
- baseブランチが進行していた場合は元のブランチをbaseの上にrebaseします。

PR作成後にbaseが進行するとGitHub上でupdate baseの作業が必要になりますが、
作成前にrebaseしておくことでこれを回避します。
PR作成前なのでrebaseで履歴が書き換わっても他者に影響しません。

スクリプトの出力は`key=value`形式で、
`current`、`base`、`owner`、`repo`、`rebased`が含まれます。
これらの値を以降のステップで使用してください。

スクリプトが失敗した場合はエラーメッセージを報告してスキルを終了してください。

# remoteへのpush

PR作成のためにはheadブランチがremoteに存在する必要があります。
以下を判断してpushを実行してください。

upstreamの有無は以下で確認できます。

```bash
git rev-parse --abbrev-ref --symbolic-full-name @{u}
```

判断基準は以下の通りです。

- upstreamが未設定: `git push -u origin <current>`で初回pushします。
- upstreamが設定済みかつ`rebased=true`: `git push --force-with-lease origin <current>`で上書きします。
  PRがまだ存在しないため、history書き換えの影響範囲はローカル開発者のみです。
- upstreamが設定済みかつ`rebased=false`でローカルが先行している場合(`git rev-list --count <upstream>..HEAD`が0でない): 通常の`git push origin <current>`で同期します。
- upstreamが設定済みかつローカルとremoteが一致している場合: pushは不要です。

# コミット履歴とdiffの把握

baseブランチからの差分を以下のコマンドで取得してください。

```bash
git log <base>..HEAD --no-merges
git diff <base>...HEAD --stat
```

差分が大きい場合は`--stat`で概要を把握してから、
必要な範囲だけ`git diff`本体で内容を確認してください。

# アサインの決定

`mcp__github__get_me`で認証済みユーザの情報を取得し、
`login`を控えてください。
PRのアサインは基本的にこの自分自身のユーザを指定します。

# ラベルの選定

まずリポジトリで定義されているラベル一覧を取得してください。
GitHub MCPにラベル一覧を取得するツールはないため、
ここだけGitHub CLIを使います。

```bash
gh label list --json name,description,color --limit 100
```

これがリポジトリで定義されている全ラベルです。
存在しないラベルを指定するとアサインとラベルの一括設定ステップが失敗するため、
ここから外れたラベルは付与しないでください。

その上で、過去のmerged PRでどのようなラベルがどんな変更に付与されているかも参考にしてください。
ラベルの定義名だけでは用途の温度感が分からないため、
実際の使われ方を観察することで適切な選定ができます。

```text
mcp__github__list_pull_requests(state="closed", sort="updated", direction="desc", perPage=30)
```

PRの内容を考慮して、
取得したラベル一覧から適切なものを選んでください。
適切なラベルが見当たらない場合はラベルなしで構いません。

# タイトルと本文の生成

`pr-style`スキルのガイドラインに従い、
タイトルと本文を生成してください。

PRに含まれるコミットが1つだけの場合は、
そのコミットメッセージのタイトルと本文をそのまま流用してください。

複数コミットがある場合は、
PR全体の変更を要約するタイトルと本文を新たに書いてください。

# 一時ファイルへの書き出し

以下のスクリプトでセッション固有の一時ディレクトリを作成し、
`PR_EDITMSG`ファイルのフルパスが取得されます。

!`prepare-editmsg.ts`

スクリプトは`$XDG_RUNTIME_DIR/coding-agent-work/pr/`配下にディレクトリを作り、
存在しない場合は再帰的に作成します。
未設定環境では`os.tmpdir()`にフォールバックします。

得たパスに`Write`ツールで内容を書き出してください。
ファイルは1行目をタイトル、
空行を挟んで本文という構造にします。

# ユーザによる確認

`AskUserQuestion`ツールを使って、
生成したタイトル、本文、アサイン、ラベルの扱いをユーザに確認してください。

質問文にはタイトルと本文の全文に加えて、
アサインするユーザと付与するラベルも含めてください。
本文が長い場合でも省略せず全文を提示してください。
ユーザが内容を見て判断できるようにするためです。

選択肢は以下を設定してください。

1. このまま作成する(Recommended): 生成された内容で作成する。
2. テキストエディタで編集する: エディタで編集してから作成する。エディタが使える環境向け。

`AskUserQuestion`ツールはこれらに加えて`Other`(自由テキスト入力)の選択肢を自動的に追加します。
`Other`が選ばれた場合はユーザの修正指示に従って内容を修正し、
確認ステップに戻ってください。

## このまま作成する場合

一時ファイルの内容をそのまま使用して、
PR作成に進んでください。

## テキストエディタで編集する場合

以下のコマンドでユーザに編集してもらいます。
タイムアウトは最大の600秒に設定してください。

```bash
editor <PR_EDITMSGのパス>
```

エディタが正常終了したら、
`Read`ツールでファイルを読み直して内容を取得し、
PR作成に進んでください。

エディタが異常終了した場合、
ユーザがPR作成をキャンセルしたいという意思表示であると解釈して、
作業をキャンセルしてください。

## 選択がキャンセルされた場合

ユーザがPR作成をキャンセルしたいという意思表示であると解釈して、
作業をキャンセルしてください。

# PRの作成

`mcp__github__create_pull_request`を使ってPRを作成してください。

引数は以下の通りです。

- `owner`: `sync-base.ts`の出力の`owner`
- `repo`: `sync-base.ts`の出力の`repo`
- `head`: `sync-base.ts`の出力の`current`
- `base`: `sync-base.ts`の出力の`base`
- `title`: 生成したタイトル
- `body`: 生成した本文
- `draft`: ユーザが明示的に指示した場合のみ`true`、それ以外は省略

GitHubのPR作成APIはassigneesとlabelsの同時設定に対応していないため、
これらは作成後に別ステップで設定します。

作成に成功するとPR番号とURLが返ります。
それらを次のステップで使用してください。

# アサインとラベルの一括設定

PR作成からアサイン/ラベル設定までのタイムラグを最小化するため、
このステップとPRの作成の間に他の処理を挟まないでください。
アサインとラベルの選定は事前に済ませている前提です。

`mcp__github__issue_write`を`update`メソッドで呼び出し、
作成したPRの番号を`issue_number`に渡し、
`assignees`と`labels`を1回で設定してください。

- `method`: `"update"`
- `owner`: `sync-base.ts`の出力の`owner`
- `repo`: `sync-base.ts`の出力の`repo`
- `issue_number`: 作成したPRの番号
- `assignees`: `[get_meで取得したlogin]`
- `labels`: 選定したラベル(該当なしの場合は省略可)

# 権限不足の場合

他人のリポジトリにPRを作成しようとしている場合など、
権限不足でアサイン設定やラベルの設定が出来ない場合があります。
その場合はエラーを検知して、
PR自体は作成されたことを報告してください。

# 完了報告

PRのURL、アサインしたユーザ、付与したラベルを含めて完了報告してください。
