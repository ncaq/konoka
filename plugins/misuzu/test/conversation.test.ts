import { it } from "@effect/vitest";
import { Effect } from "effect";
import type { Octokit } from "octokit";
import { describe, expect, vi } from "vitest";
import { getConversation } from "../src/conversation";

function makeGraphqlMock(prData: Record<string, unknown>): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    repository: { pullRequest: prData },
  });
}

describe("getConversation", () => {
  it.effect("コメント・レビュー・レビュースレッドを取得する", () =>
    Effect.gen(function* () {
      const prData = {
        title: "Test PR",
        body: "PR body",
        author: { login: "test-user" },
        url: "https://github.com/test/repo/pull/1",
        headRefName: "feature-branch",
        baseRefName: "master",
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

      const conversation = yield* getConversation(octokit, {
        owner: "test",
        repo: "repo",
        prNumber: 1,
      });

      expect(conversation).toEqual({
        title: "Test PR",
        body: "PR body",
        author: "test-user",
        url: "https://github.com/test/repo/pull/1",
        headRefName: "feature-branch",
        baseRefName: "master",
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
    }),
  );

  it.effect("authorがnullの場合はnullとしてマッピングされる", () =>
    Effect.gen(function* () {
      const prData = {
        title: "Test",
        body: "",
        author: null,
        url: "https://github.com/test/repo/pull/1",
        headRefName: "feature-branch",
        baseRefName: "master",
        comments: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
        reviews: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
        reviewThreads: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
      };
      const octokit = { graphql: makeGraphqlMock(prData) } as unknown as Octokit;

      const conversation = yield* getConversation(octokit, {
        owner: "test",
        repo: "repo",
        prNumber: 1,
      });

      expect(conversation.author).toBeNull();
    }),
  );

  it.effect("スレッド内コメントが100件を超える場合は追加ページを取得する", () =>
    Effect.gen(function* () {
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
        headRefName: "feature-branch",
        baseRefName: "master",
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

      const conversation = yield* getConversation(octokit, {
        owner: "test",
        repo: "repo",
        prNumber: 1,
      });

      const thread = conversation.reviewThreads.at(0);
      expect(thread).toBeDefined();
      expect(thread?.comments).toHaveLength(101);
      expect(thread?.comments.at(100)?.body).toBe("comment 100");
    }),
  );
});

/** ページネーションテスト用に空のconnectionだけを持つPRデータを作ります。 */
function makeEmptyPrData(): Record<string, unknown> {
  return {
    title: "Test",
    body: "",
    author: null,
    url: "https://github.com/test/repo/pull/1",
    headRefName: "feature-branch",
    baseRefName: "master",
    comments: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
    reviews: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
    reviewThreads: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
  };
}

function makeCommentNode(id: string): Record<string, unknown> {
  return {
    id,
    author: { login: "user" },
    body: `body of ${id}`,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    url: `https://github.com/test/repo/pull/1#issuecomment-${id}`,
  };
}

/** PR直下connectionの追加ページ取得クエリかどうかを判定します。 */
function isConnectionPageQuery(query: string, connectionName: string): boolean {
  return (
    query.includes(`${connectionName}(first: 100, after: $after)`) && !query.includes("$threadId")
  );
}

describe("paginateConnection (getConversation経由)", () => {
  it.effect("commentsが100件を超える場合は追加ページを全件結合しcursorを進める", () => {
    const prData = {
      ...makeEmptyPrData(),
      comments: {
        pageInfo: { hasNextPage: true, endCursor: "cursor1" },
        nodes: [makeCommentNode("C1")],
      },
    };
    const graphqlMock = vi
      .fn()
      .mockImplementation((query: string, variables: { after?: string | null }) => {
        if (!isConnectionPageQuery(query, "comments")) {
          return Promise.resolve({ repository: { pullRequest: prData } });
        }
        // 3ページ目までcursorを進めて取得できることを検証します。
        if (variables.after === "cursor1") {
          return Promise.resolve({
            repository: {
              pullRequest: {
                comments: {
                  pageInfo: { hasNextPage: true, endCursor: "cursor2" },
                  nodes: [makeCommentNode("C2")],
                },
              },
            },
          });
        }
        if (variables.after === "cursor2") {
          return Promise.resolve({
            repository: {
              pullRequest: {
                comments: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [makeCommentNode("C3")],
                },
              },
            },
          });
        }
        return Promise.reject(new Error(`unexpected after cursor: ${String(variables.after)}`));
      });
    const octokit = { graphql: graphqlMock } as unknown as Octokit;

    return Effect.gen(function* () {
      const conversation = yield* getConversation(octokit, {
        owner: "test",
        repo: "repo",
        prNumber: 1,
      });

      expect(conversation.comments.map((c) => c.id)).toEqual(["C1", "C2", "C3"]);
    });
  });

  it.effect("reviewsとreviewThreadsの追加ページも取得する", () =>
    Effect.gen(function* () {
      const reviewNode = {
        id: "R1",
        author: { login: "reviewer" },
        state: "APPROVED",
        body: "LGTM",
        submittedAt: "2026-01-01T00:00:00Z",
        url: "https://github.com/test/repo/pull/1#pullrequestreview-1",
      };
      const threadNode = {
        id: "RT1",
        isResolved: false,
        isOutdated: false,
        resolvedBy: null,
        path: "src/index.ts",
        line: 1,
        startLine: null,
        diffSide: "RIGHT",
        comments: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
      };
      const prData = {
        ...makeEmptyPrData(),
        reviews: {
          pageInfo: { hasNextPage: true, endCursor: "reviews-cursor" },
          nodes: [],
        },
        reviewThreads: {
          pageInfo: { hasNextPage: true, endCursor: "threads-cursor" },
          nodes: [],
        },
      };
      const graphqlMock = vi.fn().mockImplementation((query: string) => {
        if (isConnectionPageQuery(query, "reviews")) {
          return Promise.resolve({
            repository: {
              pullRequest: {
                reviews: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [reviewNode],
                },
              },
            },
          });
        }
        if (isConnectionPageQuery(query, "reviewThreads")) {
          return Promise.resolve({
            repository: {
              pullRequest: {
                reviewThreads: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [threadNode],
                },
              },
            },
          });
        }
        return Promise.resolve({ repository: { pullRequest: prData } });
      });
      const octokit = { graphql: graphqlMock } as unknown as Octokit;

      const conversation = yield* getConversation(octokit, {
        owner: "test",
        repo: "repo",
        prNumber: 1,
      });

      expect(conversation.reviews.map((r) => r.id)).toEqual(["R1"]);
      expect(conversation.reviewThreads.map((t) => t.id)).toEqual(["RT1"]);
    }),
  );

  it.effect("追加ページのconnectionが欠落している場合はGraphQlConnectionMissingで失敗する", () =>
    Effect.gen(function* () {
      const prData = {
        ...makeEmptyPrData(),
        comments: {
          pageInfo: { hasNextPage: true, endCursor: "cursor1" },
          nodes: [],
        },
      };
      const graphqlMock = vi.fn().mockImplementation((query: string) => {
        if (isConnectionPageQuery(query, "comments")) {
          // connection名の生成がズレた場合などに相当するレスポンス欠落。
          return Promise.resolve({ repository: { pullRequest: {} } });
        }
        return Promise.resolve({ repository: { pullRequest: prData } });
      });
      const octokit = { graphql: graphqlMock } as unknown as Octokit;

      const error = yield* getConversation(octokit, {
        owner: "test",
        repo: "repo",
        prNumber: 1,
      }).pipe(Effect.flip);

      expect(error).toMatchObject({
        _tag: "GraphQlConnectionMissing",
        connectionName: "comments",
      });
    }),
  );
});
