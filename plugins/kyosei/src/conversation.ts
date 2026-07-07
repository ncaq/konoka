/**
 * PRの会話情報をGraphQL APIで取得するモジュール。
 * コメント、レビュー、レビュースレッドを1クエリで取得し、
 * 追加ページがあればページネーションで全件取得します。
 */

import { Data, Effect } from "effect";
import type { UnknownException } from "effect/Cause";
import type { Octokit } from "octokit";
import type { PrIdentifier } from "./context-type";

/** GraphQLレスポンスに期待したconnectionが含まれていない場合の失敗。 */
class GraphQlConnectionMissing extends Data.TaggedError("GraphQlConnectionMissing")<{
  readonly connectionName: string;
}> {
  override get message(): string {
    return `GraphQL response missing connection: ${this.connectionName}`;
  }
}

// --- 出力型定義 ---

/** PRの全体コメント(issue comment)。 */
export interface ConversationComment {
  readonly id: string;
  readonly author: string | null;
  readonly body: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly url: string;
}

/** PRのレビュー(APPROVE, CHANGES_REQUESTED等)。 */
export interface ConversationReview {
  readonly id: string;
  readonly author: string | null;
  readonly state: string;
  readonly body: string;
  readonly submittedAt: string | null;
  readonly url: string;
}

/** レビュースレッド内の個別コメント。 */
export interface ReviewThreadComment {
  readonly id: string;
  readonly author: string | null;
  readonly body: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly url: string;
}

/** PRのレビュースレッド(インラインコメントのスレッド)。 */
export interface ConversationReviewThread {
  readonly id: string;
  readonly isResolved: boolean;
  readonly isOutdated: boolean;
  readonly resolvedBy: string | null;
  readonly path: string;
  readonly line: number | null;
  readonly startLine: number | null;
  readonly diffSide: string;
  readonly comments: readonly ReviewThreadComment[];
}

/** PRの会話情報全体。 */
export interface Conversation {
  readonly title: string;
  readonly body: string;
  readonly author: string | null;
  readonly url: string;
  readonly comments: readonly ConversationComment[];
  readonly reviews: readonly ConversationReview[];
  readonly reviewThreads: readonly ConversationReviewThread[];
}

// --- GraphQLレスポンス型定義 ---

interface PageInfo {
  readonly hasNextPage: boolean;
  readonly endCursor: string | null;
}

interface GraphQLAuthor {
  readonly login: string;
}

interface GraphQLCommentNode {
  readonly id: string;
  readonly author: GraphQLAuthor | null;
  readonly body: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly url: string;
}

interface GraphQLReviewNode {
  readonly id: string;
  readonly author: GraphQLAuthor | null;
  readonly state: string;
  readonly body: string;
  readonly submittedAt: string | null;
  readonly url: string;
}

interface GraphQLReviewThreadNode {
  readonly id: string;
  readonly isResolved: boolean;
  readonly isOutdated: boolean;
  readonly resolvedBy: GraphQLAuthor | null;
  readonly path: string;
  readonly line: number | null;
  readonly startLine: number | null;
  readonly diffSide: string;
  readonly comments: {
    readonly pageInfo: PageInfo;
    readonly nodes: readonly GraphQLCommentNode[];
  };
}

interface GraphQLInitialResponse {
  readonly repository: {
    readonly pullRequest: {
      readonly title: string;
      readonly body: string;
      readonly author: GraphQLAuthor | null;
      readonly url: string;
      readonly comments: {
        readonly pageInfo: PageInfo;
        readonly nodes: readonly GraphQLCommentNode[];
      };
      readonly reviews: {
        readonly pageInfo: PageInfo;
        readonly nodes: readonly GraphQLReviewNode[];
      };
      readonly reviewThreads: {
        readonly pageInfo: PageInfo;
        readonly nodes: readonly GraphQLReviewThreadNode[];
      };
    };
  };
}

interface GraphQLConnection<TNode> {
  readonly pageInfo: PageInfo;
  readonly nodes: readonly TNode[];
}

interface GraphQLConnectionPageResponse<TNode> {
  readonly repository: {
    readonly pullRequest: Record<string, GraphQLConnection<TNode>>;
  };
}

// --- GraphQLクエリ ---

const commentFields = `
  id
  author { login }
  body
  createdAt
  updatedAt
  url
`;

const reviewFields = `
  id
  author { login }
  state
  body
  submittedAt
  url
`;

const reviewThreadFields = `
  id
  isResolved
  isOutdated
  resolvedBy { login }
  path
  line
  startLine
  diffSide
  comments(first: 100) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ${commentFields}
    }
  }
`;

const initialQuery = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        title
        body
        author { login }
        url
        comments(first: 100) {
          pageInfo { hasNextPage endCursor }
          nodes { ${commentFields} }
        }
        reviews(first: 100) {
          pageInfo { hasNextPage endCursor }
          nodes { ${reviewFields} }
        }
        reviewThreads(first: 100) {
          pageInfo { hasNextPage endCursor }
          nodes { ${reviewThreadFields} }
        }
      }
    }
  }
`;

function buildPageQuery(connectionName: string, nodeFields: string): string {
  return `
  query($owner: String!, $repo: String!, $number: Int!, $after: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        ${connectionName}(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { ${nodeFields} }
        }
      }
    }
  }
`;
}

const threadCommentsPageQuery = `
  query($threadId: ID!, $after: String) {
    node(id: $threadId) {
      ... on PullRequestReviewThread {
        comments(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { ${commentFields} }
        }
      }
    }
  }
`;

interface GraphQLThreadCommentsPageResponse {
  readonly node: {
    readonly comments: {
      readonly pageInfo: PageInfo;
      readonly nodes: readonly GraphQLCommentNode[];
    };
  };
}

/**
 * レビュースレッド内コメントを全件取得します。
 * 初回取得分に加えて、100件を超えている場合は追加ページを取得して結合します。
 */
function getAllThreadComments(
  octokit: Octokit,
  thread: GraphQLReviewThreadNode,
): Effect.Effect<readonly GraphQLCommentNode[], Error> {
  return Effect.gen(function* () {
    const allNodes: GraphQLCommentNode[] = [...thread.comments.nodes];
    let { hasNextPage, endCursor } = thread.comments.pageInfo;
    while (hasNextPage) {
      const page = yield* Effect.tryPromise(() =>
        octokit.graphql<GraphQLThreadCommentsPageResponse>(threadCommentsPageQuery, {
          threadId: thread.id,
          after: endCursor,
        }),
      );
      allNodes.push(...page.node.comments.nodes);
      hasNextPage = page.node.comments.pageInfo.hasNextPage;
      endCursor = page.node.comments.pageInfo.endCursor;
    }
    return allNodes;
  });
}

// --- マッピング関数 ---

function mapCommentNode(node: GraphQLCommentNode): ConversationComment {
  return {
    id: node.id,
    author: node.author?.login ?? null,
    body: node.body,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    url: node.url,
  };
}

function mapReviewNode(node: GraphQLReviewNode): ConversationReview {
  return {
    id: node.id,
    author: node.author?.login ?? null,
    state: node.state,
    body: node.body,
    submittedAt: node.submittedAt,
    url: node.url,
  };
}

function mapReviewThreadNode(
  octokit: Octokit,
  node: GraphQLReviewThreadNode,
): Effect.Effect<ConversationReviewThread, Error> {
  return Effect.gen(function* () {
    const allComments = yield* getAllThreadComments(octokit, node);
    return {
      id: node.id,
      isResolved: node.isResolved,
      isOutdated: node.isOutdated,
      resolvedBy: node.resolvedBy?.login ?? null,
      path: node.path,
      line: node.line,
      startLine: node.startLine,
      diffSide: node.diffSide,
      comments: allComments.map(mapCommentNode),
    };
  });
}

// --- メイン関数 ---

/**
 * PRの会話情報をGraphQL APIで取得します。
 * コメント、レビュー、レビュースレッドを全件取得します。
 */
export function getConversation(
  octokit: Octokit,
  target: PrIdentifier,
): Effect.Effect<Conversation, Error> {
  return Effect.gen(function* () {
    const variables = {
      owner: target.owner,
      repo: target.repo,
      number: target.prNumber,
    };

    // 初回クエリで3つのconnectionを同時に取得します。
    const initial = yield* Effect.tryPromise(() =>
      octokit.graphql<GraphQLInitialResponse>(initialQuery, variables),
    );
    const pr = initial.repository.pullRequest;

    const commentNodes: GraphQLCommentNode[] = [...pr.comments.nodes];
    const reviewNodes: GraphQLReviewNode[] = [...pr.reviews.nodes];
    const reviewThreadNodes: GraphQLReviewThreadNode[] = [...pr.reviewThreads.nodes];

    // 追加ページが必要なconnectionを並列で取得します。
    yield* Effect.all(
      [
        paginateConnection(
          octokit,
          variables,
          "comments",
          commentFields,
          pr.comments.pageInfo,
          commentNodes,
        ),
        paginateConnection(
          octokit,
          variables,
          "reviews",
          reviewFields,
          pr.reviews.pageInfo,
          reviewNodes,
        ),
        paginateConnection(
          octokit,
          variables,
          "reviewThreads",
          reviewThreadFields,
          pr.reviewThreads.pageInfo,
          reviewThreadNodes,
        ),
      ],
      { concurrency: "unbounded" },
    );

    const reviewThreads = yield* Effect.all(
      reviewThreadNodes.map((node) => mapReviewThreadNode(octokit, node)),
      { concurrency: "unbounded" },
    );

    return {
      title: pr.title,
      body: pr.body,
      author: pr.author?.login ?? null,
      url: pr.url,
      comments: commentNodes.map(mapCommentNode),
      reviews: reviewNodes.map(mapReviewNode),
      reviewThreads,
    };
  });
}

interface PaginationVariables {
  readonly owner: string;
  readonly repo: string;
  readonly number: number;
}

function paginateConnection<TNode>(
  octokit: Octokit,
  variables: PaginationVariables,
  connectionName: string,
  nodeFields: string,
  pageInfo: PageInfo,
  accumulator: TNode[],
): Effect.Effect<void, GraphQlConnectionMissing | UnknownException> {
  return Effect.gen(function* () {
    const query = buildPageQuery(connectionName, nodeFields);
    let cursor = pageInfo.endCursor;
    let hasNextPage = pageInfo.hasNextPage;
    while (hasNextPage) {
      const page = yield* Effect.tryPromise(() =>
        octokit.graphql<GraphQLConnectionPageResponse<TNode>>(query, {
          ...variables,
          after: cursor,
        }),
      );
      const connection = page.repository.pullRequest[connectionName];
      if (connection == null) {
        return yield* new GraphQlConnectionMissing({ connectionName });
      }
      accumulator.push(...connection.nodes);
      hasNextPage = connection.pageInfo.hasNextPage;
      cursor = connection.pageInfo.endCursor;
    }
  });
}
