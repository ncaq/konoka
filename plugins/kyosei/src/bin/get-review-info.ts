/**
 * レビュー情報を統合的に取得して個別ファイルへ出力するCLIエントリポイント。
 * SKILL.mdの埋め込みコマンドとして使用します。
 */

import { NodeServices, NodeRuntime } from "@effect/platform-node";
import { Console, Effect, Option, Schema } from "effect";
import { Command } from "effect/cli";
import { prUrlArgument } from "../cli-params";
import { createOctokitClient } from "../client";
import { detectReviewContext } from "../context";
import { getReviewInfo } from "../review-info";
import { ReviewInfoFilePathsSchema, writeReviewInfoFiles } from "../review-info-files";

const command = Command.make("get-review-info", { prUrl: prUrlArgument }, ({ prUrl }) =>
  Effect.gen(function* () {
    const octokit = yield* createOctokitClient();
    const context = yield* detectReviewContext(octokit, Option.getOrUndefined(prUrl));
    const reviewInfo = yield* getReviewInfo(octokit, context);
    const reviewInfoFilePaths = yield* writeReviewInfoFiles(reviewInfo);
    const output = yield* Schema.encodeEffect(Schema.fromJsonString(ReviewInfoFilePathsSchema))(
      reviewInfoFilePaths,
    );
    yield* Console.log(output);
  }),
);

const cli = Command.run(command, {
  version: "0.0.0",
});

cli.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
