---
name: research
description: Cross-source search for technical investigation, documentation lookup, library issue/PR tracking, and package information retrieval. Use when the user asks to research, investigate, or look up technical topics across multiple sources.
argument-hint: "query"
context: fork
agent: general-purpose
allowed-tools: Agent(research:survey)
---

`$ARGUMENTS`の内容を調査してください。

`survey`エージェントを起動し、`$ARGUMENTS`をそのまま渡してください。

エージェントから返された結果を整理し、
情報源のURLを明記した上でユーザに報告してください。
