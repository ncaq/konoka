import { it } from "@effect/vitest";
import { Effect, Option, Schema } from "effect";
import type { Octokit } from "octokit";
import { beforeEach, describe, expect, vi } from "vitest";
import { getChangeset } from "../src/changeset";
import { getConversation } from "../src/conversation";
import { getIncrementalChangeset, IncrementalChangesetSchema } from "../src/incremental-changeset";
import { pickPreviousKyoseiReview, PreviousReviewSchema } from "../src/previous-review";
import { getReviewInfo } from "../src/review-info";
import { fakeCommandExecutor } from "./fake-command";

vi.mock("../src/changeset", () => ({
  getChangeset: vi.fn(),
}));

vi.mock("../src/conversation", () => ({
  getConversation: vi.fn(),
}));

vi.mock("../src/previous-review", async () => {
  const actual = await vi.importActual<typeof import("../src/previous-review")>("../src/previous-review");
  return {
    ...actual,
    pickPreviousKyoseiReview: vi.fn(),
  };
});

vi.mock("../src/incremental-changeset", async () => {
  const actual = await vi.importActual<typeof import("../src/incremental-changeset")>("../src/incremental-changeset");
  return {
    ...actual,
    getIncrementalChangeset: vi.fn(),
  };
});

const mockedGetChangeset = vi.mocked(getChangeset);
const mockedGetConversation = vi.mocked(getConversation);
const mockedPickPrevious = vi.mocked(pickPreviousKyoseiReview);
const mockedGetIncremental = vi.mocked(getIncrementalChangeset);

const dummyOctokit = {} as Octokit;
const dummyChangeset = { diff: "diff", log: "log" };
const dummyChangesetWithHead = {
  diff: "diff",
  log: "log",
  headCommitId: "feedfacefeedfacefeedfacefeedfacefeedface",
};
const dummyConversation = {
  title: "PR",
  body: "",
  author: "user",
  url: "https://github.com/test/repo/pull/1",
  comments: [],
  reviews: [],
  reviewThreads: [],
};

const dummyPreviousReview = Schema.decodeUnknownSync(PreviousReviewSchema)({
  reviewId: "R1",
  commit: "abcdef1abcdef1abcdef1abcdef1abcdef1abcd1",
  event: "APPROVED",
  submittedAt: "2026-04-01T00:00:00Z",
  metadata: {
    commit: "abcdef1abcdef1abcdef1abcdef1abcdef1abcd1",
    pr: 1,
    kyoseiVersion: "3.3.0",
    kyoseiActionVersion: "unknown",
    claudeCodeVersion: "unknown",
    model: "claude-opus-4-7",
    execution: "Claude Code CLI" as const,
  },
});
const dummyIncrementalChangeset = Schema.decodeUnknownSync(IncrementalChangesetSchema)({
  baseSha: "abcdef1abcdef1abcdef1abcdef1abcdef1abcd1",
  headSha: "feedfacefeedfacefeedfacefeedfacefeedface",
  baseTreeSha: "aaa0000000000000000000000000000000000000",
  headTreeSha: "aaa0000000000000000000000000000000000000",
  status: "tree-identical",
});

const noCommandLayer = fakeCommandExecutor(() => Effect.die(new Error("CommandExecutor should not be invoked")));

describe("getReviewInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPickPrevious.mockReturnValue(Option.none());
    mockedGetIncremental.mockReturnValue(Effect.succeed(dummyIncrementalChangeset));
  });

  it.layer(noCommandLayer)((it) => {
    it.effect("PRが特定できている場合はchangesetとconversationを並列で取得する", () =>
      Effect.gen(function* () {
        mockedGetChangeset.mockReturnValue(Effect.succeed(dummyChangeset));
        mockedGetConversation.mockReturnValue(Effect.succeed(dummyConversation));

        const context = {
          output: "local" as const,
          pr: { owner: "test", repo: "repo", prNumber: 1 },
          baseBranch: "master",
          remoteName: "origin",
        };

        const reviewInfo = yield* getReviewInfo(dummyOctokit, context);

        expect(reviewInfo.context).toBe(context);
        expect(reviewInfo.changeset).toBe(dummyChangeset);
        expect(reviewInfo.conversation).toBe(dummyConversation);
        expect(mockedGetChangeset).toHaveBeenCalledWith(dummyOctokit, context);
        expect(mockedGetConversation).toHaveBeenCalledWith(dummyOctokit, context.pr);
      }),
    );

    it.effect("PRが特定できていない場合はchangesetのみ取得しconversationは含まない", () =>
      Effect.gen(function* () {
        mockedGetChangeset.mockReturnValue(Effect.succeed(dummyChangeset));

        const context = {
          output: "local" as const,
          baseBranch: "master",
        };

        const reviewInfo = yield* getReviewInfo(dummyOctokit, context);

        expect(reviewInfo.context).toBe(context);
        expect(reviewInfo.changeset).toBe(dummyChangeset);
        expect(reviewInfo.conversation).toBeUndefined();
        expect(reviewInfo.previousReview).toBeUndefined();
        expect(reviewInfo.incrementalChangeset).toBeUndefined();
        expect(mockedGetConversation).not.toHaveBeenCalled();
        expect(mockedGetIncremental).not.toHaveBeenCalled();
      }),
    );

    it.effect("GitHub出力モードでもPRがあればconversationを取得する", () =>
      Effect.gen(function* () {
        mockedGetChangeset.mockReturnValue(Effect.succeed(dummyChangeset));
        mockedGetConversation.mockReturnValue(Effect.succeed(dummyConversation));

        const context = {
          output: "github" as const,
          host: "github.com",
          pr: { owner: "test", repo: "repo", prNumber: 1 },
        };

        const reviewInfo = yield* getReviewInfo(dummyOctokit, context);

        expect(reviewInfo.conversation).toBe(dummyConversation);
      }),
    );

    it.effect("previousReviewが取れてheadCommitIdもあればincrementalChangesetも返す", () =>
      Effect.gen(function* () {
        mockedGetChangeset.mockReturnValue(Effect.succeed(dummyChangesetWithHead));
        mockedGetConversation.mockReturnValue(Effect.succeed(dummyConversation));
        mockedPickPrevious.mockReturnValue(Option.some(dummyPreviousReview));

        const context = {
          output: "github" as const,
          host: "github.com",
          pr: { owner: "test", repo: "repo", prNumber: 1 },
        };

        const reviewInfo = yield* getReviewInfo(dummyOctokit, context);

        expect(reviewInfo.previousReview).toBe(dummyPreviousReview);
        expect(reviewInfo.incrementalChangeset).toBe(dummyIncrementalChangeset);
        expect(mockedGetIncremental).toHaveBeenCalledWith(
          dummyOctokit,
          context.pr,
          dummyPreviousReview.metadata.commit,
          dummyChangesetWithHead.headCommitId,
        );
      }),
    );

    it.effect("previousReviewが取れてもheadCommitIdが無ければincrementalChangesetは省く", () =>
      Effect.gen(function* () {
        mockedGetChangeset.mockReturnValue(Effect.succeed(dummyChangeset)); // headCommitIdなし
        mockedGetConversation.mockReturnValue(Effect.succeed(dummyConversation));
        mockedPickPrevious.mockReturnValue(Option.some(dummyPreviousReview));

        const context = {
          output: "local" as const,
          pr: { owner: "test", repo: "repo", prNumber: 1 },
          baseBranch: "master",
        };

        const reviewInfo = yield* getReviewInfo(dummyOctokit, context);

        expect(reviewInfo.previousReview).toBeUndefined();
        expect(reviewInfo.incrementalChangeset).toBeUndefined();
        expect(mockedGetIncremental).not.toHaveBeenCalled();
      }),
    );

    it.effect("previousReviewが取れなければincrementalChangesetも省く", () =>
      Effect.gen(function* () {
        mockedGetChangeset.mockReturnValue(Effect.succeed(dummyChangesetWithHead));
        mockedGetConversation.mockReturnValue(Effect.succeed(dummyConversation));
        mockedPickPrevious.mockReturnValue(Option.none());

        const context = {
          output: "github" as const,
          host: "github.com",
          pr: { owner: "test", repo: "repo", prNumber: 1 },
        };

        const reviewInfo = yield* getReviewInfo(dummyOctokit, context);

        expect(reviewInfo.previousReview).toBeUndefined();
        expect(reviewInfo.incrementalChangeset).toBeUndefined();
        expect(mockedGetIncremental).not.toHaveBeenCalled();
      }),
    );
  });
});
