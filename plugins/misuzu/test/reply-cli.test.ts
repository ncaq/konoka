import { FileSystem } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { NodeContext } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { Effect, ParseResult, type Scope } from "effect";
import type { Octokit } from "octokit";
import { describe, expect, vi } from "vitest";
import { runReplyAndResolve } from "../src/reply-cli";

const validSubmission = {
  owner: "ncaq",
  repo: "konoka",
  prNumber: 42,
  threadReplies: [{ threadId: "PRRT_1", body: "reply 1", resolve: false }],
};

function writeSubmissionFile(
  content: string,
): Effect.Effect<string, PlatformError, FileSystem.FileSystem | Scope.Scope> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const dir = yield* fs.makeTempDirectoryScoped();
    const path = `${dir}/submission.json`;
    yield* fs.writeFileString(path, content);
    return path;
  });
}

/** 呼ばれたらテストを失敗させるOctokit生成Effect。dry-run経路の検証に使います。 */
const octokitMustNotBeUsed = Effect.die("octokit must not be created in dry-run");

/** graphql呼び出しが常に失敗するOctokitモックを作ります。 */
function makeFailingOctokit(): Octokit {
  const graphql = vi.fn().mockImplementation(() => Promise.reject(new Error("boom")));
  return { graphql, rest: { issues: {} } } as unknown as Octokit;
}

describe("runReplyAndResolve", () => {
  it.scoped("dry-runは投稿せずに検証済みデータを出力する", () =>
    Effect.gen(function* () {
      const path = yield* writeSubmissionFile(JSON.stringify(validSubmission));
      const outcome = yield* runReplyAndResolve({
        submissionPath: path,
        dryRun: true,
        makeOctokit: octokitMustNotBeUsed,
      });
      expect(outcome.partialFailure).toBe(false);
      expect(JSON.parse(outcome.output)).toEqual({
        dryRun: true,
        submission: validSubmission,
      });
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("スキーマに合わないJSONファイルはParseErrorで失敗する", () =>
    Effect.gen(function* () {
      const path = yield* writeSubmissionFile(JSON.stringify({ owner: "ncaq" }));
      const error = yield* runReplyAndResolve({
        submissionPath: path,
        dryRun: true,
        makeOctokit: octokitMustNotBeUsed,
      }).pipe(Effect.flip);
      expect(ParseResult.isParseError(error)).toBe(true);
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("存在しないファイルパスは失敗する", () =>
    Effect.gen(function* () {
      const error = yield* runReplyAndResolve({
        submissionPath: "/nonexistent/submission.json",
        dryRun: true,
        makeOctokit: octokitMustNotBeUsed,
      }).pipe(Effect.flip);
      expect(error).toBeDefined();
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("投稿に成功するとpartialFailureはfalseで結果JSONを出力する", () =>
    Effect.gen(function* () {
      const graphql = vi.fn().mockResolvedValue({
        addPullRequestReviewThreadReply: {
          comment: { id: "c1", url: "https://github.com/ncaq/konoka/pull/42#discussion_r1" },
        },
      });
      const octokit = { graphql, rest: { issues: {} } } as unknown as Octokit;
      const path = yield* writeSubmissionFile(JSON.stringify(validSubmission));
      const outcome = yield* runReplyAndResolve({
        submissionPath: path,
        dryRun: false,
        makeOctokit: Effect.succeed(octokit),
      });
      expect(outcome.partialFailure).toBe(false);
      const result = JSON.parse(outcome.output) as { succeeded: unknown[]; failed: unknown[] };
      expect(result.succeeded).toHaveLength(1);
      expect(result.failed).toHaveLength(0);
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("一部の投稿が失敗するとpartialFailureがtrueになる", () =>
    Effect.gen(function* () {
      const octokit = makeFailingOctokit();
      const path = yield* writeSubmissionFile(JSON.stringify(validSubmission));
      const outcome = yield* runReplyAndResolve({
        submissionPath: path,
        dryRun: false,
        makeOctokit: Effect.succeed(octokit),
      });
      expect(outcome.partialFailure).toBe(true);
      const result = JSON.parse(outcome.output) as { failed: { threadId: string }[] };
      expect(result.failed[0]?.threadId).toBe("PRRT_1");
    }).pipe(Effect.provide(NodeContext.layer)),
  );
});
