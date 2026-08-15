/**
 * レビュー対応に必要な情報を取得して個別ファイルへ出力するCLIエントリポイント。
 * SKILL.mdの埋め込みコマンドとして使用します。
 */

import process from "node:process";
import { Args, Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect, Option, Schema } from "effect";
import { createOctokitClient } from "../client";
import { detectReviewContext } from "../context";
import { getConversation } from "../conversation";
import { verifyContextHost } from "../host-check";
import { RespondInfoFilePathsSchema, writeRespondInfoFiles } from "../respond-info-files";

const prUrl = Args.text({ name: "pr-url" }).pipe(
  Args.withDescription(
    "対象PRまたはレビューのURL。省略時はカレントブランチからPRを推定し、" +
      "PRが見つからなければローカルコンテキストになります。",
  ),
  Args.optional,
);

const command = Command.make("get-respond-info", { prUrl }, ({ prUrl }) =>
  Effect.gen(function* () {
    const octokit = yield* createOctokitClient();
    const context = yield* detectReviewContext(octokit, Option.getOrUndefined(prUrl));
    // 誤ったホストの同名リポジトリを対象にしないよう、クライアントの向き先と突き合わせます。
    yield* verifyContextHost(context);
    const conversation =
      context.pr == null ? undefined : yield* getConversation(octokit, context.pr);
    const respondInfoFilePaths = yield* writeRespondInfoFiles({
      context,
      ...(conversation == null ? {} : { conversation }),
    });
    const output = yield* Schema.encode(Schema.parseJson(RespondInfoFilePathsSchema))(
      respondInfoFilePaths,
    );
    yield* Console.log(output);
  }),
);

const cli = Command.run(command, {
  name: "get-respond-info",
  version: "0.0.0",
});

cli(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);
