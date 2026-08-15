/**
 * レビュー対応情報を個別ファイルへ書き出すモジュール。
 * 標準出力を汚さずにSKILL.mdへファイルパスだけを渡すために使います。
 */

import { tmpdir } from "node:os";
import { isAbsolute } from "node:path";
import { FileSystem, Path } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { Config, Effect, ParseResult, Schema } from "effect";
import { ReviewContextSchema, type ReviewContext } from "./context-type";
import { ConversationSchema, type Conversation } from "./conversation";

const AbsolutePathSchema = Schema.NonEmptyString.pipe(
  Schema.filter(isAbsolute, { description: "absolute file path" }),
);

export const RespondInfoFilePathsSchema = Schema.Struct({
  context: AbsolutePathSchema,
  conversation: Schema.optionalWith(AbsolutePathSchema, { exact: true }),
});

export type RespondInfoFilePaths = typeof RespondInfoFilePathsSchema.Type;

/** レビュー対応情報。conversationはPRが特定できた場合のみ含まれます。 */
export interface RespondInfo {
  readonly context: ReviewContext;
  readonly conversation?: Conversation;
}

const personalWorkDirectory = Config.nonEmptyString("RUNNER_TEMP").pipe(
  Effect.orElse(() => Config.nonEmptyString("XDG_RUNTIME_DIR")),
  Effect.orElseSucceed(() => tmpdir()),
);

function encodeJson<A, I>(
  schema: Schema.Schema<A, I>,
  value: A,
): Effect.Effect<string, ParseResult.ParseError> {
  return Schema.encode(Schema.parseJson(schema))(value).pipe(
    Effect.map((encoded) => `${encoded}\n`),
  );
}

/** レビュー対応情報を個別ファイルへ書き込み、各ファイルの絶対パスを返します。 */
export function writeRespondInfoFiles(
  respondInfo: RespondInfo,
): Effect.Effect<
  RespondInfoFilePaths,
  PlatformError | ParseResult.ParseError,
  FileSystem.FileSystem | Path.Path
> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const personalWorkDir = yield* personalWorkDirectory;
    const baseDirectory = path.resolve(personalWorkDir, "coding-agent-work", "misuzu");
    yield* fs.makeDirectory(baseDirectory, { recursive: true, mode: 0o700 });
    const workDirectory = yield* fs.makeTempDirectory({
      directory: baseDirectory,
      prefix: "respond-info-",
    });

    const context = path.join(workDirectory, "context.json");
    const conversationValue = respondInfo.conversation;
    const conversationPath = path.join(workDirectory, "conversation.json");

    yield* Effect.all(
      [
        encodeJson(ReviewContextSchema, respondInfo.context).pipe(
          Effect.flatMap((encoded) => fs.writeFileString(context, encoded)),
        ),
        conversationValue == null
          ? Effect.void
          : encodeJson(ConversationSchema, conversationValue).pipe(
              Effect.flatMap((encoded) => fs.writeFileString(conversationPath, encoded)),
            ),
      ],
      { concurrency: "unbounded" },
    );

    return yield* Schema.decodeUnknown(RespondInfoFilePathsSchema)({
      context,
      ...(conversationValue == null ? {} : { conversation: conversationPath }),
    });
  });
}
