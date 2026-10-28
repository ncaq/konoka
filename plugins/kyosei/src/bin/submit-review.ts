/**
 * PRレビューを一括投稿するCLIエントリポイント。
 * コマンドライン引数からJSON形式のレビューデータを受け取り、GitHub APIでレビューを投稿します。
 */

import { NodeServices, NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { Argument, Command } from "effect/cli";
import { dryRunFlag } from "../cli-params";
import { createOctokitClient } from "../client";
import { decodeReviewSubmission } from "../review-decoder";
import { previewReview, submitReview } from "../review-poster";

const json = Argument.String("json").pipe(
  Argument.withDescription("レビュー投稿用のJSON文字列(ReviewSubmissionSchemaに準拠)。"),
);

const command = Command.make("submit-review", { dryRun: dryRunFlag, json }, ({ dryRun, json }) =>
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
  version: "0.0.0",
});

cli.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
