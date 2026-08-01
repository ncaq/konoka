import { tmpdir } from "node:os";
import { isAbsolute } from "node:path";
import { FileSystem, Path } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { Config, Effect, ParseResult, Schema } from "effect";
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

const personalWorkDirectory = Config.nonEmptyString("XDG_RUNTIME_DIR").pipe(
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

/** レビュー情報を個別ファイルへ書き込み、各ファイルの絶対パスを返します。 */
export function writeReviewInfoFiles(
  reviewInfo: ReviewInfo,
): Effect.Effect<
  ReviewInfoFilePaths,
  PlatformError | ParseResult.ParseError,
  FileSystem.FileSystem | Path.Path
> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const personalWorkDir = yield* personalWorkDirectory;
    const baseDirectory = path.resolve(personalWorkDir, "coding-agent-work", "kyosei");
    yield* fs.makeDirectory(baseDirectory, { recursive: true, mode: 0o700 });
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
