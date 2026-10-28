/**
 * PRレビューを一括投稿するCLIエントリポイント。
 * コマンドライン引数からJSON形式のレビューデータを受け取り、GitHub APIでレビューを投稿します。
 */

import { NodeServices, NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { createOctokitClient } from "../client";
import { decodeReviewSubmission } from "../review-decoder";
import { previewReview, submitReview } from "../review-poster";

const dryRun = Flag.Boolean("dry-run").pipe(
  Flag.withDescription(
    "投稿せずに、組み立て済みのcreateReviewパラメータをJSON出力します。スキーマ検証とメタデータフッター生成は実行されます。",
  ),
  // v4の`Flag.Boolean`は省略すると必須扱いになるため、省略時は`false`にします。
  Flag.withDefault(false),
);

const json = Argument.String("json").pipe(
  Argument.withDescription("レビュー投稿用のJSON文字列(ReviewSubmissionSchemaに準拠)。"),
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
  version: "0.0.0",
});

cli.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
