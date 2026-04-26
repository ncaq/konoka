import { it } from "@effect/vitest";
import { Effect } from "effect";
import type { Octokit } from "octokit";
import { beforeEach, describe, expect, vi } from "vitest";
import { getChangeset } from "../src/changeset";
import { getConversation } from "../src/conversation";
import { getReviewInfo } from "../src/review-info";
import { fakeCommandExecutor } from "./fake-command";

vi.mock("../src/changeset", () => ({
  getChangeset: vi.fn(),
}));

vi.mock("../src/conversation", () => ({
  getConversation: vi.fn(),
}));

const mockedGetChangeset = vi.mocked(getChangeset);
const mockedGetConversation = vi.mocked(getConversation);

const dummyOctokit = {} as Octokit;
const dummyChangeset = { diff: "diff", log: "log" };
const dummyConversation = {
  title: "PR",
  body: "",
  author: "user",
  url: "https://github.com/test/repo/pull/1",
  comments: [],
  reviews: [],
  reviewThreads: [],
};

const noCommandLayer = fakeCommandExecutor(() => Effect.die(new Error("CommandExecutor should not be invoked")));

describe("getReviewInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        expect(mockedGetConversation).not.toHaveBeenCalled();
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
  });
});
