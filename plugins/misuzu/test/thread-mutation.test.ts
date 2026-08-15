import { it } from "@effect/vitest";
import { Effect } from "effect";
import type { Octokit } from "octokit";
import { describe, expect, vi } from "vitest";
import type { ReplySubmission } from "../src/reply-schema";
import { submitReplies } from "../src/thread-mutation";

const baseSubmission: ReplySubmission = {
  owner: "ncaq",
  repo: "konoka",
  prNumber: 42,
  threadReplies: [
    { threadId: "PRRT_1", body: "reply 1", resolve: true },
    { threadId: "PRRT_2", body: "reply 2", resolve: false },
  ],
};

interface OctokitMock {
  octokit: Octokit;
  graphql: ReturnType<typeof vi.fn>;
  createComment: ReturnType<typeof vi.fn>;
}

/**
 * GraphQLとRESTの両方をフェイクするOctokitモックを作ります。
 * graphqlはmutation文字列に応じて返信・resolveのレスポンスを返し分けます。
 */
function makeOctokitMock(): OctokitMock {
  const graphql = vi.fn().mockImplementation((query: string, variables: { threadId: string }) => {
    if (query.includes("addPullRequestReviewThreadReply")) {
      return Promise.resolve({
        addPullRequestReviewThreadReply: {
          comment: {
            id: `comment-of-${variables.threadId}`,
            url: `https://github.com/ncaq/konoka/pull/42#discussion_r${variables.threadId.length}`,
          },
        },
      });
    }
    if (query.includes("resolveReviewThread")) {
      return Promise.resolve({
        resolveReviewThread: {
          thread: { id: variables.threadId, isResolved: true },
        },
      });
    }
    return Promise.reject(new Error(`unexpected query: ${query}`));
  });
  const createComment = vi.fn().mockResolvedValue({
    data: { html_url: "https://github.com/ncaq/konoka/pull/42#issuecomment-1" },
  });
  const octokit = {
    graphql,
    rest: { issues: { createComment } },
  } as unknown as Octokit;
  return { octokit, graphql, createComment };
}

describe("submitReplies", () => {
  it.effect("返信とresolveを投稿して結果を返す", () =>
    Effect.gen(function* () {
      const { octokit, graphql, createComment } = makeOctokitMock();
      const result = yield* submitReplies(octokit, baseSubmission);
      expect(result.failed).toEqual([]);
      expect(result.succeeded.map((s) => ({ threadId: s.threadId, resolved: s.resolved }))).toEqual(
        [
          { threadId: "PRRT_1", resolved: true },
          { threadId: "PRRT_2", resolved: false },
        ],
      );
      // resolve指定はPRRT_1のみなので、mutationは返信2回+resolve1回の3回です。
      expect(graphql).toHaveBeenCalledTimes(3);
      expect(createComment).not.toHaveBeenCalled();
      expect(result.summaryCommentUrl).toBeUndefined();
    }),
  );

  it.effect("返信コメントのURLが不正でも投稿成功として扱いresolveも実行する", () =>
    Effect.gen(function* () {
      const { octokit, graphql } = makeOctokitMock();
      graphql.mockImplementation((query: string, variables: { threadId: string }) => {
        if (query.includes("addPullRequestReviewThreadReply")) {
          // APIは成功したがURLが想定外の形式で返ってきたケース。
          return Promise.resolve({
            addPullRequestReviewThreadReply: {
              comment: { id: "c", url: "not a valid url" },
            },
          });
        }
        return Promise.resolve({
          resolveReviewThread: {
            thread: { id: variables.threadId, isResolved: true },
          },
        });
      });
      const result = yield* submitReplies(octokit, baseSubmission);
      // 返信自体は投稿済みなので、URLが読めなくても失敗扱いにして再試行(二重投稿)を誘発しない。
      expect(result.failed).toEqual([]);
      expect(result.succeeded.map((s) => ({ threadId: s.threadId, resolved: s.resolved }))).toEqual(
        [
          { threadId: "PRRT_1", resolved: true },
          { threadId: "PRRT_2", resolved: false },
        ],
      );
      expect(result.succeeded[0]?.replyUrl).toBeUndefined();
    }),
  );

  it.effect("summaryCommentを指定するとPR全体コメントを投稿する", () =>
    Effect.gen(function* () {
      const { octokit, createComment } = makeOctokitMock();
      const result = yield* submitReplies(octokit, {
        ...baseSubmission,
        threadReplies: [],
        summaryComment: "総括コメント",
      });
      expect(createComment).toHaveBeenCalledWith({
        owner: "ncaq",
        repo: "konoka",
        issue_number: 42,
        body: "総括コメント",
      });
      expect(result.summaryCommentUrl).toEqual(
        new URL("https://github.com/ncaq/konoka/pull/42#issuecomment-1"),
      );
    }),
  );

  it.effect("返信に失敗したスレッドはfailedに含まれ他スレッドの処理は続行される", () =>
    Effect.gen(function* () {
      const { octokit, graphql } = makeOctokitMock();
      const original = graphql.getMockImplementation();
      // 実行順序に依存しないよう、threadIdで条件分岐して失敗させます。
      graphql.mockImplementation((query: string, variables: { threadId: string }) => {
        if (query.includes("addPullRequestReviewThreadReply") && variables.threadId === "PRRT_1") {
          return Promise.reject(new Error("boom"));
        }
        return original?.(query, variables) as Promise<unknown>;
      });
      const result = yield* submitReplies(octokit, baseSubmission);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]?.threadId).toBe("PRRT_1");
      expect(result.failed[0]?.message).toContain("reply failed");
      expect(result.succeeded.map((s) => s.threadId)).toEqual(["PRRT_2"]);
    }),
  );

  it.effect("resolveに失敗した場合はpush権限のヒントを含むメッセージでfailedに含まれる", () =>
    Effect.gen(function* () {
      const { octokit, graphql } = makeOctokitMock();
      graphql.mockImplementation((query: string, variables: { threadId: string }) => {
        if (query.includes("addPullRequestReviewThreadReply")) {
          return Promise.resolve({
            addPullRequestReviewThreadReply: {
              comment: { id: "c", url: "https://github.com/ncaq/konoka/pull/42#discussion_r1" },
            },
          });
        }
        return Promise.reject(new Error(`FORBIDDEN: ${variables.threadId}`));
      });
      const result = yield* submitReplies(octokit, baseSubmission);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]?.threadId).toBe("PRRT_1");
      expect(result.failed[0]?.message).toContain("resolve failed");
      expect(result.failed[0]?.message).toContain("push権限");
      // resolve指定のないPRRT_2は返信成功として扱われます。
      expect(result.succeeded.map((s) => s.threadId)).toEqual(["PRRT_2"]);
    }),
  );

  it.effect("summaryCommentの投稿失敗はfailedとは別のフィールドで報告される", () =>
    Effect.gen(function* () {
      const { octokit, createComment } = makeOctokitMock();
      createComment.mockImplementation(() => Promise.reject(new Error("comment boom")));
      const result = yield* submitReplies(octokit, {
        ...baseSubmission,
        threadReplies: [],
        summaryComment: "総括コメント",
      });
      // スレッド失敗と種別を分離し、threadIdの名前空間に擬似IDを混ぜない。
      expect(result.failed).toEqual([]);
      expect(result.summaryCommentError).toContain("summary comment failed");
      expect(result.summaryCommentUrl).toBeUndefined();
    }),
  );
});
