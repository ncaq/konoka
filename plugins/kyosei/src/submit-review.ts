/**
 * PRレビューを一括投稿するモジュール。
 * レビュー本文とインラインコメントを1回のAPI呼び出しで投稿します。
 */

import { Schema } from "effect";
import type { Octokit } from "octokit";

const DiffSideSchema = Schema.Literal("LEFT", "RIGHT");

const ReviewLevelSchema = Schema.Literal("critical", "high", "medium", "low", "info");

const ReviewCommentSchema = Schema.Struct({
  path: Schema.NonEmptyString,
  body: Schema.NonEmptyString,
  line: Schema.Number.pipe(Schema.int(), Schema.positive()),
  startLine: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.positive()), { exact: true }),
  side: Schema.optionalWith(DiffSideSchema, { exact: true }),
  level: ReviewLevelSchema,
});

/**
 * レビュー投稿の入力スキーマ。
 * レビューイベント(APPROVE/COMMENT/REQUEST_CHANGES)は
 * コメントのlevelから自動的に決定します。
 */
const ReviewSubmissionSchema = Schema.Struct({
  owner: Schema.NonEmptyString,
  repo: Schema.NonEmptyString,
  prNumber: Schema.Number.pipe(Schema.int(), Schema.positive()),
  headCommitId: Schema.optionalWith(Schema.NonEmptyString, { exact: true }),
  body: Schema.NonEmptyString,
  comments: Schema.optionalWith(Schema.Array(ReviewCommentSchema), { exact: true }),
});

/** インラインコメントの入力。 */
type ReviewComment = typeof ReviewCommentSchema.Type;

/** レビュー投稿の入力。 */
type ReviewSubmission = typeof ReviewSubmissionSchema.Type;

/** GitHub APIに渡すレビューイベント。 */
type ReviewEvent = "APPROVE" | "COMMENT" | "REQUEST_CHANGES";

/** レビュー投稿の結果。 */
interface ReviewSubmissionResult {
  readonly reviewId: number;
  readonly htmlUrl: string;
}

/**
 * コメントのlevel一覧からレビューイベントを決定します。
 * - criticalの指摘がある → REQUEST_CHANGES
 * - 全ての指摘がlow以下 → APPROVE
 * - それ以外 → COMMENT
 */
function deriveReviewEvent(comments: readonly ReviewComment[] | undefined): ReviewEvent {
  if (comments == null || comments.length === 0) {
    return "APPROVE";
  }
  const hasCritical = comments.some((c) => c.level === "critical");
  if (hasCritical) {
    return "REQUEST_CHANGES";
  }
  const allLowOrBelow = comments.every((c) => c.level === "low" || c.level === "info");
  if (allLowOrBelow) {
    return "APPROVE";
  }
  return "COMMENT";
}

/**
 * JSON文字列をパース・バリデーションして`ReviewSubmission`に変換します。
 * JSONパースまたはバリデーション失敗時はエラーメッセージを含む例外をスローします。
 */
export function decodeReviewSubmission(input: string): ReviewSubmission {
  return Schema.decodeUnknownSync(Schema.parseJson(ReviewSubmissionSchema), { onExcessProperty: "error" })(input);
}

/**
 * PRレビューを投稿します。
 * `octokit.rest.pulls.createReview`を使い、
 * レビュー本文とインラインコメントを1回のAPI呼び出しで一括投稿します。
 * レビューイベントはコメントのlevelから自動的に決定します。
 */
export async function submitReview(octokit: Octokit, submission: ReviewSubmission): Promise<ReviewSubmissionResult> {
  const event = deriveReviewEvent(submission.comments);
  const response = await octokit.rest.pulls.createReview({
    owner: submission.owner,
    repo: submission.repo,
    pull_number: submission.prNumber,
    ...(submission.headCommitId != null ? { commit_id: submission.headCommitId } : {}),
    event,
    body: submission.body,
    comments:
      submission.comments?.map((c) => ({
        path: c.path,
        body: c.body,
        line: c.line,
        side: c.side ?? "RIGHT",
        ...(c.startLine != null ? { start_line: c.startLine, start_side: c.side ?? "RIGHT" } : {}),
      })) ?? [],
  });
  return {
    reviewId: response.data.id,
    htmlUrl: response.data.html_url,
  };
}
