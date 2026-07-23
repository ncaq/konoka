---
name: research
description: Investigate any topic by querying multiple external sources (web, official docs, GitHub, MCP servers). Use whenever a question requires information not already in the working context, including library behavior, API specifications, error diagnostics, version comparisons, or general factual lookup.
argument-hint: "query"
allowed-tools: Agent(claude-code-guide), Skill(research:survey)
model: opus
effort: medium
---

# クエリの分解

`$ARGUMENTS`を分析し、
独立して調査可能なサブクエリに分解してください。

## 分解の方針

- 比較調査(AとBの比較)は対象ごとに分ける
- 複数の技術トピックが含まれる場合はトピックごとに分ける
- 1つのトピックでも異なる情報ソースで調べるべき側面があれば分ける
  - 公式ドキュメント
  - GitHub Issue/PR
  - コミュニティの評判
- 分解できない単一の質問はそのまま1つのサブクエリとする

# 調査手段の選択の指針

## `research:survey`スキル

常に利用してください。

`context: fork`で定義されているため、
Skillツールでサブクエリを引数に渡して起動すると、
独立したサブエージェントとして実行されます。

`claude-code-guide`エージェントを利用する場合も、
`research:survey`スキルも併用して調査してください。

## `claude-code-guide`エージェント

以下のトピックに該当する場合は利用してください。

- Claude Code
  - CLIツール
  - フック
  - スラッシュコマンド
  - MCPサーバ
  - 設定
  - IDE連携
  - キーボードショートカット
- Claude Agent SDK
  - カスタムエージェントの構築
- Claude API
  - ツール利用
  - Anthropic API
  - Anthropic SDK

# 並列調査

分解した各サブクエリに対して、
適切な調査手段(`research:survey`スキル、`claude-code-guide`エージェント)を並列で起動してください。
全ての調査を同時に起動することが重要です。

各起動には、
そのサブクエリの調査に必要な文脈を含めて渡してください。

# 結果の統合

全ての調査結果を統合し、
情報源のURLを明記した上で報告してください。
サブクエリ間で矛盾する情報がある場合はその旨を明記してください。
