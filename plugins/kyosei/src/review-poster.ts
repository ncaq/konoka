/**
 * PRレビューをGitHub APIに投稿するモジュール。
 * レビュー本文とインラインコメントを1回のAPI呼び出しで投稿します。
 * 投稿前にインラインコメントの行番号を差分と照合し、
 * 1件でも不正ならAPIを呼ばずに失敗します。
 */

import { Effect } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import type { Octokit } from "octokit";
import { formatReviewCommentBody } from "./review-comment-body";
import { type InvalidReviewCommentLines, validateCommentLines } from "./review-comment-lines";
import { buildReviewBody } from "./review-metadata";
import { ReviewSubmissionSchema, type ReviewSubmissionResultSchema } from "./review-schema";
import type { DiffFile } from "./unified-diff";

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
 * `diffFiles`はレビュー対象の差分で、インラインコメントの行番号の検証に使います。
 */
export function submitReview(
  octokit: Octokit,
  submission: typeof ReviewSubmissionSchema.Type,
  diffFiles: readonly DiffFile[],
): Effect.Effect<
  typeof ReviewSubmissionResultSchema.Type,
  InvalidReviewCommentLines | Error,
  ChildProcessSpawner.ChildProcessSpawner
> {
  return Effect.gen(function* () {
    // メタデータ生成は子プロセス起動を伴うため、不正な入力はその前に弾きます。
    yield* validateCommentLines(diffFiles, submission.comments ?? []);
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
 * 入力スキーマの検証(`decodeReviewSubmission`)、インラインコメントの行番号検証(`validateCommentLines`)、
 * メタデータフッター生成(`buildReviewBody`)を実走するため、
 * パイプライン全体の動作確認に使えます。
 */
export function previewReview(
  submission: typeof ReviewSubmissionSchema.Type,
  diffFiles: readonly DiffFile[],
): Effect.Effect<
  CreateReviewParams,
  InvalidReviewCommentLines,
  ChildProcessSpawner.ChildProcessSpawner
> {
  return Effect.gen(function* () {
    yield* validateCommentLines(diffFiles, submission.comments ?? []);
    const body = yield* buildReviewBody(submission);
    return buildCreateReviewParams(submission, body);
  });
}
