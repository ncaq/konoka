/**
 * PRレビューをGitHub APIに投稿するモジュール。
 * レビュー本文とインラインコメントを1回のAPI呼び出しで投稿します。
 */

import { type CommandExecutor } from "@effect/platform";
import { Effect } from "effect";
import type { Octokit } from "octokit";
import { formatReviewCommentBody } from "./review-comment-body";
import { buildReviewBody } from "./review-metadata";
import { ReviewSubmissionSchema, type ReviewSubmissionResultSchema } from "./review-schema";

/** `octokit.rest.pulls.createReview`に渡すパラメータ型。 */
export type CreateReviewParams = NonNullable<
  Parameters<Octokit["rest"]["pulls"]["createReview"]>[0]
>;

/**
 * `submission`とメタデータ付与済みの`body`から、`octokit.rest.pulls.createReview`へ渡すパラメータを組み立てます。
 * API呼び出しは行いません。`submitReview`と`previewReview`の双方で共有されます。
 */
function buildCreateReviewParams(
  submission: typeof ReviewSubmissionSchema.Type,
  body: string,
): CreateReviewParams {
  return {
    owner: submission.owner,
    repo: submission.repo,
    pull_number: submission.prNumber,
    commit_id: submission.headCommitId,
    event: submission.event,
    body,
    comments:
      submission.comments?.map((c) => ({
        path: c.path,
        body: formatReviewCommentBody(c),
        line: c.line,
        side: c.side ?? "RIGHT",
        ...(c.startLine != null ? { start_line: c.startLine, start_side: c.side ?? "RIGHT" } : {}),
      })) ?? [],
  };
}

/**
 * PRレビューを投稿します。
 * `octokit.rest.pulls.createReview`を使い、
 * レビュー本文とインラインコメントを1回のAPI呼び出しで一括投稿します。
 * レビューイベントは入力の`event`フィールドで指定します。
 */
export function submitReview(
  octokit: Octokit,
  submission: typeof ReviewSubmissionSchema.Type,
): Effect.Effect<typeof ReviewSubmissionResultSchema.Type, Error, CommandExecutor.CommandExecutor> {
  return Effect.gen(function* () {
    const body = yield* buildReviewBody(submission);
    const params = buildCreateReviewParams(submission, body);
    const response = yield* Effect.tryPromise(() => octokit.rest.pulls.createReview(params));
    return {
      reviewId: response.data.id,
      htmlUrl: new URL(response.data.html_url),
    };
  });
}

/**
 * 投稿はせずに、`submitReview`が`octokit.rest.pulls.createReview`へ渡すであろうパラメータを組み立てて返します。
 * 入力スキーマの検証(`decodeReviewSubmission`)とメタデータフッター生成(`buildReviewBody`)を実走するため、
 * パイプライン全体の動作確認に使えます。
 */
export function previewReview(
  submission: typeof ReviewSubmissionSchema.Type,
): Effect.Effect<CreateReviewParams, never, CommandExecutor.CommandExecutor> {
  return Effect.gen(function* () {
    const body = yield* buildReviewBody(submission);
    return buildCreateReviewParams(submission, body);
  });
}
