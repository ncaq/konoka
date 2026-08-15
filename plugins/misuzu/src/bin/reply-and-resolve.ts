/**
 * レビュースレッドへの返信とresolveを一括投稿するCLIエントリポイント。
 * コマンドライン引数からJSON形式の投稿データを受け取り、GitHub APIで投稿します。
 */

import process from "node:process";
import { Args, Command, Options } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Data, Effect, Schema } from "effect";
import { createOctokitClient } from "../client";
import { decodeReplySubmission, ReplySubmissionResultSchema } from "../reply-schema";
import { submitReplies } from "../thread-mutation";

/** 一部でも投稿に失敗した場合の失敗。SKILL側が失敗分のみ再試行できるように結果全体を保持します。 */
class PartialSubmissionFailure extends Data.TaggedError("PartialSubmissionFailure")<{
  readonly encodedResult: string;
}> {
  override get message(): string {
    return `some replies failed: ${this.encodedResult}`;
  }
}

const dryRun = Options.boolean("dry-run").pipe(
  Options.withDescription(
    "投稿せずに、スキーマ検証済みの投稿予定データをJSON出力します。GitHub APIへのアクセスは行われません。",
  ),
);

const json = Args.text({ name: "json" }).pipe(
  Args.withDescription("返信+resolve投稿用のJSON文字列(ReplySubmissionSchemaに準拠)。"),
);

const command = Command.make("reply-and-resolve", { dryRun, json }, ({ dryRun, json }) =>
  Effect.gen(function* () {
    const submission = decodeReplySubmission(json);
    if (dryRun) {
      yield* Console.log(JSON.stringify({ dryRun: true, submission }));
      return;
    }
    const octokit = yield* createOctokitClient();
    const result = yield* submitReplies(octokit, submission);
    const encoded = yield* Schema.encode(Schema.parseJson(ReplySubmissionResultSchema))(result);
    yield* Console.log(encoded);
    if (0 < result.failed.length) {
      // 失敗があった場合は非0終了させてSKILL側に再試行の判断を促します。
      return yield* new PartialSubmissionFailure({ encodedResult: encoded });
    }
  }),
);

const cli = Command.run(command, {
  name: "reply-and-resolve",
  version: "0.0.0",
});

cli(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);
