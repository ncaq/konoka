/**
 * PRレビューを一括投稿するCLIエントリポイント。
 * コマンドライン引数からJSON形式のレビューデータを受け取り、GitHub APIでレビューを投稿します。
 */

import process from "node:process";
import { Args, Command, Options } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { createOctokitClient } from "../client";
import { decodeReviewSubmission } from "../review-decoder";
import { previewReview, submitReview } from "../review-poster";

const dryRun = Options.boolean("dry-run").pipe(
  Options.withDescription(
    "投稿せずに、組み立て済みのcreateReviewパラメータをJSON出力します。スキーマ検証とメタデータフッター生成は実行されます。",
  ),
);

const json = Args.text({ name: "json" }).pipe(
  Args.withDescription("レビュー投稿用のJSON文字列(ReviewSubmissionSchemaに準拠)。"),
);

const command = Command.make("submit-review", { dryRun, json }, ({ dryRun, json }) =>
  Effect.gen(function* () {
    const submission = decodeReviewSubmission(json);
    if (dryRun) {
      const params = yield* previewReview(submission);
      yield* Console.log(JSON.stringify({ dryRun: true, params }, null, 2));
      return;
    }
    const octokit = yield* createOctokitClient();
    const submissionResult = yield* submitReview(octokit, submission);
    yield* Console.log(JSON.stringify(submissionResult, null, 2));
  }),
);

const cli = Command.run(command, {
  name: "submit-review",
  version: "0.0.0",
});

cli(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);
