import { tmpdir } from "node:os";
import { isAbsolute } from "node:path";
import process from "node:process";
import { FileSystem, Path } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { Config, Data, Effect, Option, ParseResult, Schema } from "effect";
import { ReviewContextSchema } from "./context-type";
import { ConversationSchema } from "./conversation";
import { IncrementalChangesetSchema } from "./incremental-changeset";
import type { ReviewInfo } from "./review-info";
import {
  ExecutionSchema,
  PrNumberSchema,
  SemVerSchema,
  ShaSchema,
  UnknownLiteral,
} from "./review-schema";

export const ChangesetMetadataSchema = Schema.Struct({ headCommitId: ShaSchema });

export const PreviousReviewFileSchema = Schema.Struct({
  reviewId: Schema.NonEmptyString,
  event: Schema.NonEmptyString,
  submittedAt: Schema.DateTimeUtc,
  metadata: Schema.Struct({
    commit: ShaSchema,
    pr: PrNumberSchema,
    kyoseiVersion: SemVerSchema,
    kyoseiActionVersion: Schema.Union(SemVerSchema, UnknownLiteral),
    claudeCodeVersion: Schema.Union(SemVerSchema, UnknownLiteral),
    model: Schema.NonEmptyString,
    execution: ExecutionSchema,
    runUrl: Schema.optionalWith(Schema.URL, { exact: true }),
  }),
});

const AbsolutePathSchema = Schema.NonEmptyString.pipe(
  Schema.filter(isAbsolute, { description: "absolute file path" }),
);

export const ReviewInfoFilePathsSchema = Schema.Struct({
  context: AbsolutePathSchema,
  patch: AbsolutePathSchema,
  commits: AbsolutePathSchema,
  changesetMetadata: Schema.optionalWith(AbsolutePathSchema, { exact: true }),
  conversation: Schema.optionalWith(AbsolutePathSchema, { exact: true }),
  previousReview: Schema.optionalWith(AbsolutePathSchema, { exact: true }),
  incrementalChangeset: Schema.optionalWith(AbsolutePathSchema, { exact: true }),
});

export type ReviewInfoFilePaths = typeof ReviewInfoFilePathsSchema.Type;

const personalWorkDirectory = Config.nonEmptyString("RUNNER_TEMP").pipe(
  Effect.orElse(() => Config.nonEmptyString("XDG_RUNTIME_DIR")),
  Effect.orElseSucceed(() => tmpdir()),
);

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

function encodeJson<A, I>(
  schema: Schema.Schema<A, I>,
  value: A,
): Effect.Effect<string, ParseResult.ParseError> {
  return Schema.encode(Schema.parseJson(schema))(value).pipe(
    Effect.map((encoded) => `${encoded}\n`),
  );
}

/** レビュー情報を個別ファイルへ書き込み、各ファイルの絶対パスを返します。 */
export function writeReviewInfoFiles(
  reviewInfo: ReviewInfo,
): Effect.Effect<
  ReviewInfoFilePaths,
  PlatformError | ParseResult.ParseError | UnsafeWorkDirectory,
  FileSystem.FileSystem | Path.Path
> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const personalWorkDir = yield* personalWorkDirectory;
    const baseDirectory = path.resolve(personalWorkDir, "coding-agent-work", "kyosei");
    yield* ensurePrivateDirectory(fs, baseDirectory);
    const workDirectory = yield* fs.makeTempDirectory({
      directory: baseDirectory,
      prefix: "review-info-",
    });

    const context = path.join(workDirectory, "context.json");
    const patch = path.join(workDirectory, "changeset.patch");
    const commits = path.join(workDirectory, "commits.log");
    const headCommitId = reviewInfo.changeset.headCommitId;
    const changesetMetadata = path.join(workDirectory, "changeset-metadata.json");
    const conversationValue = reviewInfo.conversation;
    const conversationPath = path.join(workDirectory, "conversation.json");
    const previousReviewValue = reviewInfo.previousReview;
    const previousReviewPath = path.join(workDirectory, "previous-review.json");
    const incrementalChangesetValue = reviewInfo.incrementalChangeset;
    const incrementalChangesetPath = path.join(workDirectory, "incremental-changeset.json");

    yield* Effect.all(
      [
        encodeJson(ReviewContextSchema, reviewInfo.context).pipe(
          Effect.flatMap((encoded) => fs.writeFileString(context, encoded)),
        ),
        fs.writeFileString(patch, reviewInfo.changeset.diff),
        fs.writeFileString(commits, reviewInfo.changeset.log),
        headCommitId == null
          ? Effect.void
          : encodeJson(ChangesetMetadataSchema, { headCommitId }).pipe(
              Effect.flatMap((encoded) => fs.writeFileString(changesetMetadata, encoded)),
            ),
        conversationValue == null
          ? Effect.void
          : encodeJson(ConversationSchema, conversationValue).pipe(
              Effect.flatMap((encoded) => fs.writeFileString(conversationPath, encoded)),
            ),
        previousReviewValue == null
          ? Effect.void
          : encodeJson(PreviousReviewFileSchema, previousReviewValue).pipe(
              Effect.flatMap((encoded) => fs.writeFileString(previousReviewPath, encoded)),
            ),
        incrementalChangesetValue == null
          ? Effect.void
          : encodeJson(IncrementalChangesetSchema, incrementalChangesetValue).pipe(
              Effect.flatMap((encoded) => fs.writeFileString(incrementalChangesetPath, encoded)),
            ),
      ],
      { concurrency: "unbounded" },
    );

    return yield* Schema.decodeUnknown(ReviewInfoFilePathsSchema)({
      context,
      patch,
      commits,
      ...(headCommitId == null ? {} : { changesetMetadata }),
      ...(conversationValue == null ? {} : { conversation: conversationPath }),
      ...(previousReviewValue == null ? {} : { previousReview: previousReviewPath }),
      ...(incrementalChangesetValue == null
        ? {}
        : { incrementalChangeset: incrementalChangesetPath }),
    });
  });
}
