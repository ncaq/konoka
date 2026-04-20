import type { Octokit } from "octokit";
import { describe, expect, test, vi } from "vitest";
import { getConversation } from "../src/conversation.js";

function makeGraphqlMock(prData: Record<string, unknown>): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    repository: { pullRequest: prData },
  });
}

describe("getConversation", () => {
  test("コメント・レビュー・レビュースレッドを取得する", async () => {
    const prData = {
      title: "Test PR",
      body: "PR body",
      author: { login: "test-user" },
      url: "https://github.com/test/repo/pull/1",
      comments: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [
          {
            id: "C1",
            author: { login: "commenter" },
            body: "comment body",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
            url: "https://github.com/test/repo/pull/1#issuecomment-1",
          },
        ],
      },
      reviews: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [
          {
            id: "R1",
            author: { login: "reviewer" },
            state: "APPROVED",
            body: "LGTM",
            submittedAt: "2026-01-01T00:00:00Z",
            url: "https://github.com/test/repo/pull/1#pullrequestreview-1",
          },
        ],
      },
      reviewThreads: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [
          {
            id: "RT1",
            isResolved: false,
            isOutdated: false,
            resolvedBy: null,
            path: "src/index.ts",
            line: 10,
            startLine: null,
            diffSide: "RIGHT",
            comments: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  id: "TC1",
                  author: { login: "reviewer" },
                  body: "thread comment",
                  createdAt: "2026-01-01T00:00:00Z",
                  updatedAt: "2026-01-01T00:00:00Z",
                  url: "https://github.com/test/repo/pull/1#discussion_r1",
                },
              ],
            },
          },
        ],
      },
    };
    const octokit = { graphql: makeGraphqlMock(prData) } as unknown as Octokit;

    const conversation = await getConversation(octokit, { owner: "test", repo: "repo", prNumber: 1 });

    expect(conversation).toEqual({
      title: "Test PR",
      body: "PR body",
      author: "test-user",
      url: "https://github.com/test/repo/pull/1",
      comments: [
        {
          id: "C1",
          author: "commenter",
          body: "comment body",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          url: "https://github.com/test/repo/pull/1#issuecomment-1",
        },
      ],
      reviews: [
        {
          id: "R1",
          author: "reviewer",
          state: "APPROVED",
          body: "LGTM",
          submittedAt: "2026-01-01T00:00:00Z",
          url: "https://github.com/test/repo/pull/1#pullrequestreview-1",
        },
      ],
      reviewThreads: [
        {
          id: "RT1",
          isResolved: false,
          isOutdated: false,
          resolvedBy: null,
          path: "src/index.ts",
          line: 10,
          startLine: null,
          diffSide: "RIGHT",
          comments: [
            {
              id: "TC1",
              author: "reviewer",
              body: "thread comment",
              createdAt: "2026-01-01T00:00:00Z",
              updatedAt: "2026-01-01T00:00:00Z",
              url: "https://github.com/test/repo/pull/1#discussion_r1",
            },
          ],
        },
      ],
    });
  });

  test("authorがnullの場合はnullとしてマッピングされる", async () => {
    const prData = {
      title: "Test",
      body: "",
      author: null,
      url: "https://github.com/test/repo/pull/1",
      comments: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
      reviews: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
      reviewThreads: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
    };
    const octokit = { graphql: makeGraphqlMock(prData) } as unknown as Octokit;

    const conversation = await getConversation(octokit, { owner: "test", repo: "repo", prNumber: 1 });

    expect(conversation.author).toBeNull();
  });

  test("スレッド内コメントが100件を超える場合は追加ページを取得する", async () => {
    const threadCommentNodes = Array.from({ length: 100 }, (_, i) => ({
      id: `TC${i}`,
      author: { login: "user" },
      body: `comment ${i}`,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      url: `https://github.com/test/repo/pull/1#discussion_r${i}`,
    }));

    const prData = {
      title: "Test",
      body: "",
      author: null,
      url: "https://github.com/test/repo/pull/1",
      comments: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
      reviews: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
      reviewThreads: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [
          {
            id: "RT1",
            isResolved: false,
            isOutdated: false,
            resolvedBy: null,
            path: "src/index.ts",
            line: 1,
            startLine: null,
            diffSide: "RIGHT",
            comments: {
              pageInfo: { hasNextPage: true, endCursor: "cursor1" },
              nodes: threadCommentNodes,
            },
          },
        ],
      },
    };

    const additionalComment = {
      id: "TC100",
      author: { login: "user" },
      body: "comment 100",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      url: "https://github.com/test/repo/pull/1#discussion_r100",
    };

    const graphqlMock = vi
      .fn()
      // 初回: PR全体の取得
      .mockResolvedValueOnce({ repository: { pullRequest: prData } })
      // 2回目: スレッド内コメントの追加ページ
      .mockResolvedValueOnce({
        node: {
          comments: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [additionalComment],
          },
        },
      });
    const octokit = { graphql: graphqlMock } as unknown as Octokit;

    const conversation = await getConversation(octokit, { owner: "test", repo: "repo", prNumber: 1 });

    const thread = conversation.reviewThreads.at(0);
    expect(thread).toBeDefined();
    expect(thread?.comments).toHaveLength(101);
    expect(thread?.comments.at(100)?.body).toBe("comment 100");
  });
});
