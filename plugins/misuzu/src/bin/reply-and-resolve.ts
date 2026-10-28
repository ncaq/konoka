/**
 * レビュースレッドへの返信とresolveを一括投稿するCLIエントリポイント。
 * 投稿データはJSONファイルのパスで受け取り、GitHub APIで投稿します。
 * 本体ロジックは`../reply-cli`にあります。
 */

import { NodeServices, NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { Argument, Command } from "effect/cli";
import { dryRunFlag } from "../cli-params";
import { createOctokitClient } from "../client";
import { PartialSubmissionFailure, runReplyAndResolve } from "../reply-cli";

const dryRun = dryRunFlag;

const submissionPath = Argument.String("submission-path").pipe(
  Argument.withDescription(
    "返信+resolve投稿用のJSONファイルのパス(ReplySubmissionSchemaに準拠)。" +
      "本文にはuntrustedな文字列が入るため、引数のJSON文字列ではなくファイルで受け取ります。",
  ),
);

const contextPath = Argument.String("context-path").pipe(
  Argument.withDescription(
    "get-respond-infoが出力したcontext.jsonのパス。" +
      "投稿JSONの投稿先がここで検出済みのPRと一致しない場合は投稿せずに失敗します。",
  ),
);

const command = Command.make(
  "reply-and-resolve",
  { dryRun, submissionPath, contextPath },
  ({ dryRun, submissionPath, contextPath }) =>
    Effect.gen(function* () {
      const outcome = yield* runReplyAndResolve({
        submissionPath,
        contextPath,
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
  version: "0.0.0",
});

cli.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
