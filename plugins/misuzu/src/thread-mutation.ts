/**
 * レビュースレッドへの返信・resolve・PR全体コメントを投稿するモジュール。
 * スレッド返信とresolveはGraphQL mutation、PR全体コメントはREST APIを使います。
 */

import { Effect } from "effect";
import type { Octokit } from "octokit";
import type {
  ReplySubmission,
  ReplySubmissionResult,
  ThreadReply,
  ThreadReplyFailureSchema,
  ThreadReplyResultSchema,
} from "./reply-schema";

/** `addPullRequestReviewThreadReply` mutationのレスポンス型。 */
interface AddReplyResponse {
  addPullRequestReviewThreadReply: {
    comment: {
      id: string;
      url: string;
    };
  };
}

const addReplyMutation = /* GraphQL */ `
  mutation ($threadId: ID!, $body: String!) {
    addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) {
      comment {
        id
        url
      }
    }
  }
`;

/** `resolveReviewThread` mutationのレスポンス型。 */
interface ResolveThreadResponse {
  resolveReviewThread: {
    thread: {
      id: string;
      isResolved: boolean;
    };
  };
}

const resolveThreadMutation = /* GraphQL */ `
  mutation ($threadId: ID!) {
    resolveReviewThread(input: { threadId: $threadId }) {
      thread {
        id
        isResolved
      }
    }
  }
`;

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * 1つのスレッドへ返信し、指定されていればresolveします。
 * 失敗はEffectの失敗ではなく`failed`側の値として返し、他スレッドの処理を続行できるようにします。
 */
function submitThreadReply(
  octokit: Octokit,
  threadReply: ThreadReply,
): Effect.Effect<
  | { kind: "succeeded"; value: typeof ThreadReplyResultSchema.Type }
  | { kind: "failed"; value: typeof ThreadReplyFailureSchema.Type },
  never
> {
  return Effect.gen(function* () {
    const replyResult = yield* Effect.tryPromise(() =>
      octokit.graphql<AddReplyResponse>(addReplyMutation, {
        threadId: threadReply.threadId,
        body: threadReply.body,
      }),
    ).pipe(Effect.either);
    if (replyResult._tag === "Left") {
      return {
        kind: "failed" as const,
        value: {
          threadId: threadReply.threadId,
          message: `reply failed: ${errorMessage(replyResult.left)}`,
        },
      };
    }
    const replyUrl = new URL(replyResult.right.addPullRequestReviewThreadReply.comment.url);
    if (!threadReply.resolve) {
      return {
        kind: "succeeded" as const,
        value: { threadId: threadReply.threadId, replyUrl, resolved: false },
      };
    }
    const resolveResult = yield* Effect.tryPromise(() =>
      octokit.graphql<ResolveThreadResponse>(resolveThreadMutation, {
        threadId: threadReply.threadId,
      }),
    ).pipe(Effect.either);
    if (resolveResult._tag === "Left") {
      // 返信は成功しているので、失敗としてはresolveのみを報告します。
      return {
        kind: "failed" as const,
        value: {
          threadId: threadReply.threadId,
          message:
            `reply succeeded but resolve failed: ${errorMessage(resolveResult.left)}` +
            " (resolveにはリポジトリへのpush権限が必要です)",
        },
      };
    }
    return {
      kind: "succeeded" as const,
      value: {
        threadId: threadReply.threadId,
        replyUrl,
        resolved: resolveResult.right.resolveReviewThread.thread.isResolved,
      },
    };
  });
}

/**
 * 返信+resolveを一括投稿します。
 * スレッドごとに「返信→(指定時)resolve」を順に実行し、
 * 一部が失敗しても残りの処理を続行して結果をまとめて返します。
 * 総括コメントはREST APIでPR全体へのコメントとして投稿します。
 */
export function submitReplies(
  octokit: Octokit,
  submission: ReplySubmission,
): Effect.Effect<ReplySubmissionResult, never> {
  return Effect.gen(function* () {
    const results = yield* Effect.forEach(submission.threadReplies, (threadReply) =>
      submitThreadReply(octokit, threadReply),
    );
    const succeeded = results.filter((r) => r.kind === "succeeded").map((r) => r.value);
    const failed = results.filter((r) => r.kind === "failed").map((r) => r.value);

    const summaryComment = submission.summaryComment;
    if (summaryComment == null) {
      return { succeeded, failed };
    }
    const summaryResult = yield* Effect.tryPromise(() =>
      octokit.rest.issues.createComment({
        owner: submission.owner,
        repo: submission.repo,
        issue_number: submission.prNumber,
        body: summaryComment,
      }),
    ).pipe(Effect.either);
    if (summaryResult._tag === "Left") {
      return {
        succeeded,
        failed: [
          ...failed,
          {
            threadId: "summaryComment",
            message: `summary comment failed: ${errorMessage(summaryResult.left)}`,
          },
        ],
      };
    }
    return {
      succeeded,
      failed,
      summaryCommentUrl: new URL(summaryResult.right.data.html_url),
    };
  });
}
