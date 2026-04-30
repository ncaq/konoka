---
name: research
description: Gather up-to-date information from external sources (official docs, GitHub, MDN, Microsoft Learn, NixOS, web search) when local code and prior knowledge are not enough. Use when comparing libraries or frameworks, looking up unfamiliar APIs/specs/syntax, evaluating which approach or library to adopt, investigating library bugs or unexpected behavior, checking current best practices, or surveying ecosystem trends. Triggers include "X vs Y", "how does X work", "what is the recommended way to X", "is X still maintained", "does X support Y", or any task needing fresh information beyond the local codebase. Trigger proactively without waiting for explicit "research" or "investigate" wording. Runs investigations in an isolated context so the main conversation stays uncluttered.
argument-hint: "query"
context: fork
agent: general-purpose
allowed-tools: Agent(research:survey)
---

# クエリの分解

`$ARGUMENTS`を分析し、
独立して調査可能なサブクエリに分解してください。

分解の方針:

- 比較調査(AとBの比較)は対象ごとに分ける
- 複数の技術トピックが含まれる場合はトピックごとに分ける
- 1つのトピックでも異なる情報ソースで調べるべき側面があれば分ける
  - 公式ドキュメント
  - GitHub Issue/PR
  - コミュニティの評判
- 分解できない単一の質問はそのまま1つのサブクエリとする

# 並列調査

分解した各サブクエリに対して`survey`エージェントを並列で起動してください。
全てのエージェントを同時に起動することが重要です。

各エージェントには、
そのサブクエリの調査に必要な文脈を含めて渡してください。

# 結果の統合

全エージェントの結果を統合し、
情報源のURLを明記した上で報告してください。
サブクエリ間で矛盾する情報がある場合はその旨を明記してください。
