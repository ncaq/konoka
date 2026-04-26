/**
 * PRの会話情報をGraphQL APIで取得するモジュール。
 * コメント、レビュー、レビュースレッドを1クエリで取得し、
 * 追加ページがあればページネーションで全件取得します。
 */

import type { Octokit } from "octokit";
import type { PrIdentifier } from "./context-type";

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

const COMMENT_FIELDS = `
  id
  author { login }
  body
  createdAt
  updatedAt
  url
`;

const REVIEW_FIELDS = `
  id
  author { login }
  state
  body
  submittedAt
  url
`;

const REVIEW_THREAD_FIELDS = `
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
      ${COMMENT_FIELDS}
    }
  }
`;

const INITIAL_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        title
        body
        author { login }
        url
        comments(first: 100) {
          pageInfo { hasNextPage endCursor }
          nodes { ${COMMENT_FIELDS} }
        }
        reviews(first: 100) {
          pageInfo { hasNextPage endCursor }
          nodes { ${REVIEW_FIELDS} }
        }
        reviewThreads(first: 100) {
          pageInfo { hasNextPage endCursor }
          nodes { ${REVIEW_THREAD_FIELDS} }
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

const THREAD_COMMENTS_PAGE_QUERY = `
  query($threadId: ID!, $after: String) {
    node(id: $threadId) {
      ... on PullRequestReviewThread {
        comments(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { ${COMMENT_FIELDS} }
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
async function getAllThreadComments(
  octokit: Octokit,
  thread: GraphQLReviewThreadNode,
): Promise<readonly GraphQLCommentNode[]> {
  const allNodes: GraphQLCommentNode[] = [...thread.comments.nodes];
  let { hasNextPage, endCursor } = thread.comments.pageInfo;
  while (hasNextPage) {
    const page = await octokit.graphql<GraphQLThreadCommentsPageResponse>(THREAD_COMMENTS_PAGE_QUERY, {
      threadId: thread.id,
      after: endCursor,
    });
    allNodes.push(...page.node.comments.nodes);
    hasNextPage = page.node.comments.pageInfo.hasNextPage;
    endCursor = page.node.comments.pageInfo.endCursor;
  }
  return allNodes;
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

async function mapReviewThreadNode(octokit: Octokit, node: GraphQLReviewThreadNode): Promise<ConversationReviewThread> {
  const allComments = await getAllThreadComments(octokit, node);
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
}

// --- メイン関数 ---

/**
 * PRの会話情報をGraphQL APIで取得します。
 * コメント、レビュー、レビュースレッドを全件取得します。
 */
export async function getConversation(octokit: Octokit, target: PrIdentifier): Promise<Conversation> {
  const variables = {
    owner: target.owner,
    repo: target.repo,
    number: target.prNumber,
  };

  // 初回クエリで3つのconnectionを同時に取得します。
  const initial = await octokit.graphql<GraphQLInitialResponse>(INITIAL_QUERY, variables);
  const pr = initial.repository.pullRequest;

  const commentNodes: GraphQLCommentNode[] = [...pr.comments.nodes];
  const reviewNodes: GraphQLReviewNode[] = [...pr.reviews.nodes];
  const reviewThreadNodes: GraphQLReviewThreadNode[] = [...pr.reviewThreads.nodes];

  // 追加ページが必要なconnectionを並列で取得します。
  await Promise.all([
    paginateConnection(octokit, variables, "comments", COMMENT_FIELDS, pr.comments.pageInfo, commentNodes),
    paginateConnection(octokit, variables, "reviews", REVIEW_FIELDS, pr.reviews.pageInfo, reviewNodes),
    paginateConnection(
      octokit,
      variables,
      "reviewThreads",
      REVIEW_THREAD_FIELDS,
      pr.reviewThreads.pageInfo,
      reviewThreadNodes,
    ),
  ]);

  return {
    title: pr.title,
    body: pr.body,
    author: pr.author?.login ?? null,
    url: pr.url,
    comments: commentNodes.map(mapCommentNode),
    reviews: reviewNodes.map(mapReviewNode),
    reviewThreads: await Promise.all(reviewThreadNodes.map((node) => mapReviewThreadNode(octokit, node))),
  };
}

interface PaginationVariables {
  readonly owner: string;
  readonly repo: string;
  readonly number: number;
}

async function paginateConnection<TNode>(
  octokit: Octokit,
  variables: PaginationVariables,
  connectionName: string,
  nodeFields: string,
  pageInfo: PageInfo,
  accumulator: TNode[],
): Promise<void> {
  const query = buildPageQuery(connectionName, nodeFields);
  let cursor = pageInfo.endCursor;
  let hasNextPage = pageInfo.hasNextPage;
  while (hasNextPage) {
    const page = await octokit.graphql<GraphQLConnectionPageResponse<TNode>>(query, {
      ...variables,
      after: cursor,
    });
    const connection = page.repository.pullRequest[connectionName];
    if (connection == null) {
      throw new Error(`GraphQL response missing connection: ${connectionName}`);
    }
    accumulator.push(...connection.nodes);
    hasNextPage = connection.pageInfo.hasNextPage;
    cursor = connection.pageInfo.endCursor;
  }
}
