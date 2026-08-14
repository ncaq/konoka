---
name: pr-style
description: Pull request style guidelines covering title, body, assignee, and label selection. Use when writing or proposing GitHub pull requests, including direct `gh pr create` invocations outside the /pr skill.
allowed-tools: Bash(gh label list:*), Bash(gh pr list:*), Bash(gh pr view:*), Bash(gh repo view:*), Bash(git diff:*), Bash(git log:*), Bash(read-contributing:*), Bash(read-pull-request-template:*), mcp__github__get_me, mcp__github__list_pull_requests, mcp__github__pull_request_read
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

bot(renovate, dependabotなど)のPRは参考になりません。
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

リポジトリのスタイルがある場合はそちらを優先してください。

PRに含まれるコミットが1つだけの場合は、
そのコミットのタイトルをそのままPRのタイトルに使ってください。

PRに含まれるコミットが複数ある場合は、
PR全体の変更を要約するタイトルを新たに書いてください。

# 本文のスタイル

リポジトリ固有のテンプレートが用意されている場合は、
そのテンプレートを埋める形で本文を書いてください。

リポジトリのスタイルの個別の要素が不明な場合のデフォルトスタイルの要素は以下です。

## 言語

日本語で記述してください。

## 文体

丁寧語とですます調で書いてください。

英単語と日本語が混在する場合は、
英単語の前後にスペースを入れないでください。
中国語の風習では普通スペースを入れますが、
日本語ではスペースを入れないのも一般的で、
私は基本的にスペースなしのスタイルを採用しています。

## 行長と改行

行長は100文字以内に収めてください。
URLなど改行できないものを挿入する場合は例外です。

改行位置は句読点の後など、
自然な場所を選んでください。
不自然な場所で改行はしないでください。
改行位置が不自然になるぐらいなら文章を練りなおしてください。
日本語は英語と違い好きに改行して良い言語ではないので、
改行位置には十分注意してください。

## コードシンボル

コードのシンボル(関数名や変数名など)を本文に含める場合は、
Markdownのインラインコード記法であるバッククォートで囲んでください。

# 本文の内容

本文には変更の内容だけではなく、
なぜその変更が必要だったのか、
理由をなるべく書いてください。

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

# 使ってはいけないもの

以下はGitHub CLIやコーディングエージェントが自動挿入しがちですが、
意味のない汚染になるため使いません。
PR本文を生成するときに混入させないでください。

## 固定見出しテンプレート

`## Summary`, `## Test plan`, `## Changes`のような固定見出しは、
リポジトリのテンプレートで指定されていない限り使いません。
内容に応じて自由に文章で書いてください。

## 自動生成フッター

`Generated with Claude Code`のような署名や、
`Co-Authored-By: Claude <noreply@anthropic.com>`のようなトレーラーを付けないでください。

Claude Codeはテキストエディタの延長線上でしかないので、
ツールの名前をわざわざ書く必要はないと考えているからです。

## Markdownの強調シンタックス

Markdownの、

- `*emphasis*`
- `**strong**`
- `_emphasis_`
- `__strong__`

などの強調シンタックスは基本的に使いません。

LLMによって乱用されがちなためです。

強調しなくても意味が通じる場合は強調シンタックスを使わないでください。

強調が意味的に必要な場合は許可されます。

## 絵文字

ユーザが明示的に要求しない限り絵文字は使わないでください。

## 全角形(Fullwidth Forms)

ASCIIに対応する全角形は使用禁止です。

- 全角括弧`()`は半角`()`を使ってください。
- 全角コロン`:`は半角`:`を使ってください。
- 全角カンマ`,`は半角`,`を使ってください。
- 全角数字`0-9`は半角`0-9`を使ってください。

# issueとの関連付け

## issueをクローズする場合

そのPRがissueをクローズする場合は、
原型小文字の`close`キーワードと番号を本文に含めてください。

例:

```
close #123
```

- `closes`
- `closed`
- `fix`
- `fixes`
- `fixed`
- `resolve`
- `resolves`
- `resolved`

などの活用形や別キーワードは使いません。

原型小文字の`close`に統一してください。

## 関連を示す場合

クローズせず関連を示すだけの場合は、
原型小文字の`ref`を使ってください。

例:

```
ref #123
```

`refs`, `references`などは使いません。
原型小文字の`ref`に統一してください。

## 外部リポジトリのissue

別リポジトリのissueを参照する場合は、
わかりやすさと移動しやすさのために、
短縮記法ではなくURLを使ってください。

```
close https://github.com/owner/repo/issues/123
ref https://github.com/owner/repo/issues/456
```

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
