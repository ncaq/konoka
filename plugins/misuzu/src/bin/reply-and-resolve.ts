/**
 * レビュースレッドへの返信とresolveを一括投稿するCLIエントリポイント。
 * 投稿データはJSONファイルのパスで受け取り、GitHub APIで投稿します。
 * 本体ロジックは`../reply-cli`にあります。
 */

import process from "node:process";
import { Args, Command, Options } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { createOctokitClient } from "../client";
import { PartialSubmissionFailure, runReplyAndResolve } from "../reply-cli";

const dryRun = Options.boolean("dry-run").pipe(
  Options.withDescription(
    "投稿せずに、スキーマ検証済みの投稿予定データをJSON出力します。GitHub APIへのアクセスは行われません。",
  ),
);

const submissionPath = Args.text({ name: "submission-path" }).pipe(
  Args.withDescription(
    "返信+resolve投稿用のJSONファイルのパス(ReplySubmissionSchemaに準拠)。" +
      "本文にはuntrustedな文字列が入るため、引数のJSON文字列ではなくファイルで受け取ります。",
  ),
);

const command = Command.make(
  "reply-and-resolve",
  { dryRun, submissionPath },
  ({ dryRun, submissionPath }) =>
    Effect.gen(function* () {
      const outcome = yield* runReplyAndResolve({
        submissionPath,
        dryRun,
        makeOctokit: createOctokitClient(),
      });
      yield* Console.log(outcome.output);
      if (outcome.partialFailure) {
        // 失敗があった場合は非0終了させてSKILL側に再試行の判断を促します。
        return yield* new PartialSubmissionFailure({ encodedResult: outcome.output });
      }
    }),
);

const cli = Command.run(command, {
  name: "reply-and-resolve",
  version: "0.0.0",
});

cli(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);
