import { FileSystem, Path } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { ConfigProvider, Effect, Schema } from "effect";
import { describe, expect } from "vitest";
import { IncrementalChangesetSchema } from "../src/incremental-changeset";
import { PreviousReviewSchema } from "../src/previous-review";
import type { ReviewInfo } from "../src/review-info";
import { PreviousReviewFileSchema, writeReviewInfoFiles } from "../src/review-info-files";

const previousReview = Schema.decodeUnknownSync(PreviousReviewSchema)({
  reviewId: "PRR_test",
  event: "APPROVED",
  submittedAt: "2026-08-01T00:00:00Z",
  metadata: {
    commit: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    pr: 1,
    kyoseiVersion: "3.5.3",
    kyoseiActionVersion: "unknown",
    claudeCodeVersion: "unknown",
    model: "claude-opus-4-1",
    execution: "Claude Code CLI",
  },
});

const incrementalChangeset = Schema.decodeUnknownSync(IncrementalChangesetSchema)({
  baseSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
  headSha: "feedfacefeedfacefeedfacefeedfacefeedface",
  status: "diff-present",
  changedFileCount: 1,
  changedLineCount: 1,
});

const completeReviewInfo: ReviewInfo = {
  context: {
    output: "github",
    host: "github.com",
    pr: { owner: "test", repo: "repo", prNumber: 1 },
  },
  changeset: {
    diff: "diff --git a/file.ts b/file.ts\n+const answer = 42;\n",
    log: "commit feedface\nAuthor: Test User\n",
    headCommitId: "feedfacefeedfacefeedfacefeedfacefeedface",
  },
  conversation: {
    title: "Test PR",
    body: "Body",
    author: "test-user",
    url: "https://github.com/test/repo/pull/1",
    comments: [],
    reviews: [],
    reviewThreads: [],
  },
  previousReview,
  incrementalChangeset,
};

const localReviewInfo = {
  context: { output: "local", baseBranch: "master" },
  changeset: { diff: "local diff\n", log: "local log\n" },
} as const satisfies ReviewInfo;

describe("writeReviewInfoFiles", () => {
  it.scoped("`RUNNER_TEMP`を`XDG_RUNTIME_DIR`より優先する", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const runnerTemp = yield* fs.makeTempDirectoryScoped();
      const xdgRuntimeDirectory = yield* fs.makeTempDirectoryScoped();
      const filePaths = yield* writeReviewInfoFiles(localReviewInfo).pipe(
        Effect.withConfigProvider(
          ConfigProvider.fromMap(
            new Map([
              ["RUNNER_TEMP", runnerTemp],
              ["XDG_RUNTIME_DIR", xdgRuntimeDirectory],
            ]),
          ),
        ),
      );

      expect(filePaths.context.startsWith(path.join(runnerTemp, "coding-agent-work"))).toBe(true);
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("レビュー情報を用途別のファイルへ書き出す", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const runtimeDirectory = yield* fs.makeTempDirectoryScoped();
      const filePaths = yield* writeReviewInfoFiles(completeReviewInfo).pipe(
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map([["XDG_RUNTIME_DIR", runtimeDirectory]])),
        ),
      );

      const expectedDirectory = path.join(runtimeDirectory, "coding-agent-work", "kyosei");
      expect(path.dirname(path.dirname(filePaths.context))).toBe(expectedDirectory);
      expect(path.basename(path.dirname(filePaths.context))).toMatch(/^review-info-/);
      expect(path.isAbsolute(filePaths.context)).toBe(true);
      expect(path.basename(filePaths.context)).toBe("context.json");
      expect(path.basename(filePaths.patch)).toBe("changeset.patch");
      expect(path.basename(filePaths.commits)).toBe("commits.log");
      expect(path.basename(filePaths.changesetMetadata ?? "")).toBe("changeset-metadata.json");
      expect(path.basename(filePaths.conversation ?? "")).toBe("conversation.json");
      expect(path.basename(filePaths.previousReview ?? "")).toBe("previous-review.json");
      expect(path.basename(filePaths.incrementalChangeset ?? "")).toBe(
        "incremental-changeset.json",
      );

      expect(JSON.parse(yield* fs.readFileString(filePaths.context))).toEqual(
        completeReviewInfo.context,
      );
      expect(yield* fs.readFileString(filePaths.patch)).toBe(completeReviewInfo.changeset.diff);
      expect(yield* fs.readFileString(filePaths.commits)).toBe(completeReviewInfo.changeset.log);
      expect(JSON.parse(yield* fs.readFileString(filePaths.changesetMetadata ?? ""))).toEqual({
        headCommitId: completeReviewInfo.changeset.headCommitId,
      });
      expect(JSON.parse(yield* fs.readFileString(filePaths.conversation ?? ""))).toEqual(
        completeReviewInfo.conversation,
      );
      const previousReviewFile = yield* fs.readFileString(filePaths.previousReview ?? "");
      expect(
        yield* Schema.decodeUnknown(Schema.parseJson(PreviousReviewFileSchema))(previousReviewFile),
      ).toEqual(completeReviewInfo.previousReview);
      expect(JSON.parse(previousReviewFile)).toMatchObject({
        metadata: {
          kyoseiActionVersion: "unknown",
          claudeCodeVersion: "unknown",
        },
      });
      expect(JSON.parse(yield* fs.readFileString(filePaths.incrementalChangeset ?? ""))).toEqual(
        completeReviewInfo.incrementalChangeset,
      );
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("存在しない任意情報のファイルとパスを省略する", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const runtimeDirectory = yield* fs.makeTempDirectoryScoped();
      const filePaths = yield* writeReviewInfoFiles(localReviewInfo).pipe(
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map([["XDG_RUNTIME_DIR", runtimeDirectory]])),
        ),
      );

      expect(filePaths).not.toHaveProperty("changesetMetadata");
      expect(filePaths).not.toHaveProperty("conversation");
      expect(filePaths).not.toHaveProperty("previousReview");
      expect(filePaths).not.toHaveProperty("incrementalChangeset");
      expect(yield* fs.readFileString(filePaths.patch)).toBe(localReviewInfo.changeset.diff);
      expect(yield* fs.readFileString(filePaths.commits)).toBe(localReviewInfo.changeset.log);
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("呼び出しごとに一意な作業ディレクトリを作る", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const runtimeDirectory = yield* fs.makeTempDirectoryScoped();
      const configProvider = ConfigProvider.fromMap(
        new Map([["XDG_RUNTIME_DIR", runtimeDirectory]]),
      );
      const [first, second] = yield* Effect.all(
        [writeReviewInfoFiles(localReviewInfo), writeReviewInfoFiles(localReviewInfo)],
        { concurrency: "unbounded" },
      ).pipe(Effect.withConfigProvider(configProvider));

      expect(path.dirname(first.context)).not.toBe(path.dirname(second.context));
    }).pipe(Effect.provide(NodeContext.layer)),
  );
});
