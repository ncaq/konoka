import { Effect } from "effect";
import type { Octokit } from "octokit";
import { beforeEach, describe, expect, test, vi } from "vitest";
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

const noCommandLayer = fakeCommandExecutor(() => Effect.die(new Error("CommandExecutor should not be invoked")));

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

describe("getReviewInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("PRが特定できている場合はchangesetとconversationを並列で取得する", async () => {
    mockedGetChangeset.mockReturnValue(Effect.succeed(dummyChangeset));
    mockedGetConversation.mockReturnValue(Effect.succeed(dummyConversation));

    const context = {
      output: "local" as const,
      pr: { owner: "test", repo: "repo", prNumber: 1 },
      baseBranch: "master",
      remoteName: "origin",
    };

    const reviewInfo = await Effect.runPromise(
      getReviewInfo(dummyOctokit, context).pipe(Effect.provide(noCommandLayer)),
    );

    expect(reviewInfo.context).toBe(context);
    expect(reviewInfo.changeset).toBe(dummyChangeset);
    expect(reviewInfo.conversation).toBe(dummyConversation);
    expect(mockedGetChangeset).toHaveBeenCalledWith(dummyOctokit, context);
    expect(mockedGetConversation).toHaveBeenCalledWith(dummyOctokit, context.pr);
  });

  test("PRが特定できていない場合はchangesetのみ取得しconversationは含まない", async () => {
    mockedGetChangeset.mockReturnValue(Effect.succeed(dummyChangeset));

    const context = {
      output: "local" as const,
      baseBranch: "master",
    };

    const reviewInfo = await Effect.runPromise(
      getReviewInfo(dummyOctokit, context).pipe(Effect.provide(noCommandLayer)),
    );

    expect(reviewInfo.context).toBe(context);
    expect(reviewInfo.changeset).toBe(dummyChangeset);
    expect(reviewInfo.conversation).toBeUndefined();
    expect(mockedGetConversation).not.toHaveBeenCalled();
  });

  test("GitHub出力モードでもPRがあればconversationを取得する", async () => {
    mockedGetChangeset.mockReturnValue(Effect.succeed(dummyChangeset));
    mockedGetConversation.mockReturnValue(Effect.succeed(dummyConversation));

    const context = {
      output: "github" as const,
      host: "github.com",
      pr: { owner: "test", repo: "repo", prNumber: 1 },
    };

    const reviewInfo = await Effect.runPromise(
      getReviewInfo(dummyOctokit, context).pipe(Effect.provide(noCommandLayer)),
    );

    expect(reviewInfo.conversation).toBe(dummyConversation);
  });
});
