/**
 * レビュー対応情報を個別ファイルへ書き出すモジュール。
 * 標準出力を汚さずにSKILL.mdへファイルパスだけを渡すために使います。
 */

import { tmpdir } from "node:os";
import { isAbsolute } from "node:path";
import process from "node:process";
import { FileSystem, Path } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { Config, Data, Effect, Option, ParseResult, Schema } from "effect";
import { RespondContextSchema, type RespondContext } from "./context-type";
import { ConversationSchema, type Conversation } from "./conversation";

/** 作業ディレクトリが他者から読み書きできる状態にある場合の失敗。 */
export class UnsafeWorkDirectory extends Data.TaggedError("UnsafeWorkDirectory")<{
  readonly path: string;
  readonly reason: string;
}> {
  override get message(): string {
    return (
      `work directory is not private: ${this.path} (${this.reason}). ` +
      "TMPDIR等をユーザ専有のディレクトリに設定して再実行してください。"
    );
  }
}

/**
 * ベースディレクトリを作成し、自ユーザ専有であることを検証します。
 *
 * `makeDirectory`の`mode: 0o700`は既存ディレクトリには適用されないため、
 * 共有tmp配下で第三者が同名ディレクトリやシンボリックリンクを先回りで作成していると、
 * そのまま書き込んで内容を読まれたり別の場所へ誘導されたりする恐れがあります(CWE-377/CWE-59)。
 * 作成後にstatで実ディレクトリであること・所有者が自プロセスであること・
 * group/otherの権限がないことを検証し、満たさない場合は失敗します。
 */
function ensurePrivateDirectory(
  fs: FileSystem.FileSystem,
  path: string,
): Effect.Effect<void, PlatformError | UnsafeWorkDirectory> {
  return Effect.gen(function* () {
    yield* fs.makeDirectory(path, { recursive: true, mode: 0o700 });
    const info = yield* fs.stat(path);
    if (info.type !== "Directory") {
      return yield* new UnsafeWorkDirectory({ path, reason: `not a directory: ${info.type}` });
    }
    const processUid = process.getuid?.();
    const ownerUid = Option.getOrUndefined(info.uid);
    if (processUid != null && ownerUid != null && ownerUid !== processUid) {
      return yield* new UnsafeWorkDirectory({
        path,
        reason: `owned by another user: uid ${ownerUid}`,
      });
    }
    if ((info.mode & 0o077) !== 0) {
      return yield* new UnsafeWorkDirectory({
        path,
        reason: `accessible by group/other: mode ${(info.mode & 0o777).toString(8)}`,
      });
    }
  });
}

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
  readonly context: RespondContext;
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
  return Schema.encode(Schema.parseJson(schema, { space: 2 }))(value).pipe(
    Effect.map((encoded) => `${encoded}\n`),
  );
}

/** レビュー対応情報を個別ファイルへ書き込み、各ファイルの絶対パスを返します。 */
export function writeRespondInfoFiles(
  respondInfo: RespondInfo,
): Effect.Effect<
  RespondInfoFilePaths,
  PlatformError | ParseResult.ParseError | UnsafeWorkDirectory,
  FileSystem.FileSystem | Path.Path
> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const personalWorkDir = yield* personalWorkDirectory;
    const baseDirectory = path.resolve(personalWorkDir, "coding-agent-work", "misuzu");
    yield* ensurePrivateDirectory(fs, baseDirectory);
    const workDirectory = yield* fs.makeTempDirectory({
      directory: baseDirectory,
      prefix: "respond-info-",
    });

    const context = path.join(workDirectory, "context.json");
    const conversationValue = respondInfo.conversation;
    const conversationPath = path.join(workDirectory, "conversation.json");

    yield* Effect.all(
      [
        encodeJson(RespondContextSchema, respondInfo.context).pipe(
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
