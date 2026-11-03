/**
 * PRレビューを一括投稿するCLIエントリポイント。
 * コマンドライン引数からJSON形式のレビューデータを受け取り、
 * `--patch`で受け取った差分とインラインコメントの行番号を照合してから、
 * GitHub APIでレビューを投稿します。
 */

import { NodeServices, NodeRuntime } from "@effect/platform-node";
import { Console, Effect, FileSystem } from "effect";
import { Argument, Command } from "effect/cli";
import { dryRunFlag, patchFlag } from "../cli-params";
import { createOctokitClient } from "../client";
import { decodeReviewSubmission } from "../review-decoder";
import { previewReview, submitReview } from "../review-poster";
import { parseNumberedDiff } from "../unified-diff";

const json = Argument.String("json").pipe(
  Argument.withDescription("レビュー投稿用のJSON文字列(ReviewSubmissionSchemaに準拠)。"),
);

const command = Command.make(
  "submit-review",
  { dryRun: dryRunFlag, patch: patchFlag, json },
  ({ dryRun, patch, json }) =>
    Effect.gen(function* () {
      const submission = decodeReviewSubmission(json);
      const fs = yield* FileSystem.FileSystem;
      const diffFiles = parseNumberedDiff(yield* fs.readFileString(patch));
      if (dryRun) {
        const params = yield* previewReview(submission, diffFiles);
        yield* Console.log(JSON.stringify({ dryRun: true, params }, null, 2));
        return;
      }
      const octokit = yield* createOctokitClient();
      const submissionResult = yield* submitReview(octokit, submission, diffFiles);
      yield* Console.log(JSON.stringify(submissionResult, null, 2));
    }),
);

const cli = Command.run(command, {
  version: "0.0.0",
});

cli.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
