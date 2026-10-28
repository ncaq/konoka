/**
 * レビュー対応に必要な情報を取得して個別ファイルへ出力するCLIエントリポイント。
 * SKILL.mdの埋め込みコマンドとして使用します。
 */

import { NodeServices, NodeRuntime } from "@effect/platform-node";
import { Console, Effect, Option, Schema } from "effect";
import { Command } from "effect/cli";
import { prUrlArgument } from "../cli-params";
import { createOctokitClient } from "../client";
import { detectRespondContext } from "../context";
import { getConversation } from "../conversation";
import { verifyContextHost } from "../host-check";
import { RespondInfoFilePathsSchema, writeRespondInfoFiles } from "../respond-info-files";

const prUrl = prUrlArgument;

const command = Command.make("get-respond-info", { prUrl }, ({ prUrl }) =>
  Effect.gen(function* () {
    const octokit = yield* createOctokitClient();
    const context = yield* detectRespondContext(octokit, Option.getOrUndefined(prUrl));
    // 誤ったホストの同名リポジトリを対象にしないよう、クライアントの向き先と突き合わせます。
    yield* verifyContextHost(context);
    const conversation =
      context.pr == null ? undefined : yield* getConversation(octokit, context.pr);
    const respondInfoFilePaths = yield* writeRespondInfoFiles({
      context,
      ...(conversation == null ? {} : { conversation }),
    });
    const output = yield* Schema.encodeEffect(Schema.fromJsonString(RespondInfoFilePathsSchema))(
      respondInfoFilePaths,
    );
    yield* Console.log(output);
  }),
);

const cli = Command.run(command, {
  version: "0.0.0",
});

cli.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
