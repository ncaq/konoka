/**
 * PRレビューを一括投稿するCLIエントリポイント。
 * コマンドライン引数からJSON形式のレビューデータを受け取り、GitHub APIでレビューを投稿します。
 */

import process from "node:process";
import { Args, Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { createOctokitClient } from "../src/client";
import { decodeReviewSubmission, submitReview } from "../src/submit-review";

const json = Args.text({ name: "json" }).pipe(
  Args.withDescription("レビュー投稿用のJSON文字列(ReviewSubmissionSchemaに準拠)。"),
);

const command = Command.make("submit-review", { json }, ({ json }) =>
  Effect.gen(function* () {
    const submission = decodeReviewSubmission(json);
    const octokit = yield* createOctokitClient();
    const submissionResult = yield* submitReview(octokit, submission);
    yield* Console.log(JSON.stringify(submissionResult));
  }),
);

const cli = Command.run(command, {
  name: "submit-review",
  version: "0.0.0",
});

cli(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);
