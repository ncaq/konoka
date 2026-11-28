---
name: research
description: Investigate any topic by querying multiple external sources (web, official docs, GitHub, MCP servers). Use whenever a question requires information not already in the working context, including library behavior, API specifications, error diagnostics, version comparisons, or general factual lookup.
argument-hint: "query"
allowed-tools: >-
  Skill(research:survey)
effort: medium
---

調査クエリを独立したサブクエリに分解し、
サブクエリごとの調査を並列に起動して、
全ての結果を1つの報告に統合します。

# 調査クエリ

$ARGUMENTS

# サブクエリへの分解

調査クエリを、互いに独立して調査できるサブクエリに分解します。

- 比較の調査(AとBの比較)は、対象ごとに分けます。
- 複数の技術トピックを含む場合は、トピックごとに分けます。
- 1つのトピックでも、公式ドキュメント、GitHubのissueやPR、コミュニティの評判のように、
  異なる情報ソースで調べるべき側面があれば、側面ごとに分けます。
- 分解できない単一の質問は、そのまま1つのサブクエリにします。

# 調査手段

- `research:survey`スキル: 全てのサブクエリで使います。
  `Skill`ツールで、サブクエリを引数に渡して起動します。
- `claude-code-guide`エージェント: 以下のトピックに当たるサブクエリで、
  `research:survey`スキルと併用します。
  - Claude Code: CLIツール、フック、スラッシュコマンド、MCPサーバ、設定、IDE連携、キーボードショートカット
  - Claude Agent SDK: カスタムエージェントの構築
  - Claude API: ツール利用、Anthropic API、Anthropic SDK

どちらの調査手段も独立したサブエージェントとして動き、この会話を見られません。
渡した文面だけで調査できるように、
調査クエリやこの会話にある前提のうち、そのサブクエリの調査に必要なものを含めて渡します。

# 調査の起動

全てのサブクエリの全ての調査を、1つの応答の中から同時に起動します。
呼び出しの場で結果が返る環境では、同時に起動した調査だけが並列に進むためです。

調査の結果は、完了通知として後から届く環境と、
非対話モードのように呼び出しの場で返る環境があります。
呼び出しの場で結果が返った時点でまだ起動していない調査があれば、そのまま残りの起動に進みます。
どちらの環境でも、スキルとエージェントの全ての結果が揃ってから統合に進みます。

# 結果の統合

全ての調査結果を統合して報告します。
情報源のURLを明記します。
サブクエリの間で矛盾する情報がある場合は、その旨を明記します。
