---
name: pr
description: Generate a GitHub pull request title and body from the current branch and let the user review before creation. Use when the user wants to create a pull request.
allowed-tools: AskUserQuestion, Bash(git status:*), Bash(konoka-editor:*), Bash(prepare-editmsg:*), Bash(sync-and-push:*), Edit, Read, Skill(pr-style), Write, mcp__github__create_pull_request, mcp__github__issue_write
---

GitHubのpull requestを作成します。
AIがタイトルと本文を生成し、
ユーザが確認してから作成します。
このスキルは新規作成のみを扱います。
既存PRの更新は対象外です。

# スタイルガイドラインの適用

`Skill(pr-style)`を呼び出し、
スタイルガイドラインに従ってください。

このスキルがリポジトリ固有のCONTRIBUTINGとpull requestテンプレートを探索して読み込むため、
このスキル内で改めて読み込む必要はありません。

# baseとの同期とremoteへのpush

!`sync-and-push`

上記の埋め込みコマンドは、
baseブランチとの同期(必要ならrebase)に続けて、
headブランチをremoteへ同期します。

このスクリプトは以下を行います。

- 現在のブランチがbaseブランチでないことを確認します。
- baseブランチに切り替えてpullし、元のブランチに戻ります。
- baseブランチが進行していた場合は元のブランチをbaseの上にrebaseします。
  PR作成後にbaseが進行するとGitHub上でupdate baseの作業が必要になりますが、
  作成前にrebaseしておくことでこれを回避します。
  PR作成前なのでrebaseで履歴が書き換わっても他者に影響しません。
- upstream未設定なら`git push -u origin <current>`で初回pushします。
- upstreamと完全一致なら何もしません。
- ローカルが先行(fast-forward可能)なら`git push origin <current>`で通常pushします。
- 履歴が分岐(force pushが必要)なケースでは、
  まず同名ブランチをheadとするopen PRが存在しないことを`gh pr list`で確認し、
  存在しない場合のみ`git push --force-with-lease origin <current>`で上書きします。

スクリプトの出力は`key=value`形式で、

- `current`
- `base`
- `owner`
- `repo`
- `rebased`
- `action`

が1ブロックにまとまって含まれます。

`action`は、

- `none`
- `initial`
- `normal`
- `force`

のいずれかです。

これらの値を以降のステップで使用してください。

スクリプトの実行が失敗していた場合はエラーメッセージをそのままユーザに報告し、
PRの作成は中止してスキルを終了してください。

rebaseがコンフリクト等で失敗した場合は、
スクリプト内で`git rebase --abort`が呼ばれてrebase状態は巻き戻されています。

特にforce pushが必要だが対象ブランチに対してopen PRが既に存在するケースでは、
スクリプトはforce pushを行わずにエラー終了します。
このスキルは新規PR作成のみを扱うため、
既存PRがある場合はスキルの実行をキャンセルし、
ユーザに既存PRの更新を促してください。

# PR内容の準備

`pr-style`スキルのガイドラインに従い、
コミット履歴とdiffの把握、
タイトルと本文の生成、
アサインとラベルの決定を済ませてください。

PRに含まれるコミットが1つだけの場合は、
そのコミットメッセージのタイトルと本文をそのまま流用してください。

複数コミットがある場合は、
PR全体の変更を要約するタイトルと本文を新たに書いてください。

# 一時ファイルへの書き出し

以下のスクリプトでセッション固有の一時ディレクトリを作成し、
`PULLREQ_EDITMSG`ファイルのフルパスが取得されます。

!`prepare-editmsg`

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
2. テキストエディタで編集する: エディタで編集してから作成する。

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
konoka-editor <PULLREQ_EDITMSGのパス>
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

- `owner`: `sync-and-push`の出力の`owner`
- `repo`: `sync-and-push`の出力の`repo`
- `head`: `sync-and-push`の出力の`current`
- `base`: `sync-and-push`の出力の`base`
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
- `owner`: `sync-and-push`の出力の`owner`
- `repo`: `sync-and-push`の出力の`repo`
- `issue_number`: 作成したPRの番号
- `assignees`: `pr-style`スキルで決定したloginの配列
- `labels`: 選定したラベル(該当なしの場合は省略可)

# 権限不足の場合

他人のリポジトリにPRを作成しようとしている場合など、
権限不足でアサイン設定やラベルの設定が出来ない場合があります。
その場合はエラーを検知して、
PR自体は作成されたことを報告してください。

# 完了報告

PRのURL、アサインしたユーザ、付与したラベルを含めて完了報告してください。
