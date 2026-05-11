/**
 * レビュー情報を統合的に取得してJSON出力するCLIエントリポイント。
 * SKILL.mdの埋め込みコマンドとして使用します。
 */

import process from "node:process";
import { Args, Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect, Option } from "effect";
import { createOctokitClient } from "../client";
import { detectReviewContext } from "../context";
import { getReviewInfo } from "../review-info";

const prUrl = Args.text({ name: "pr-url" }).pipe(
  Args.withDescription(
    "対象PRのURL。省略時はカレントブランチからローカルコンテキストを推定します。",
  ),
  Args.optional,
);

const command = Command.make("get-review-info", { prUrl }, ({ prUrl }) =>
  Effect.gen(function* () {
    const octokit = yield* createOctokitClient();
    const context = yield* detectReviewContext(octokit, Option.getOrUndefined(prUrl));
    const reviewInfo = yield* getReviewInfo(octokit, context);
    yield* Console.log(JSON.stringify(reviewInfo));
  }),
);

const cli = Command.run(command, {
  name: "get-review-info",
  version: "0.0.0",
});

cli(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);
