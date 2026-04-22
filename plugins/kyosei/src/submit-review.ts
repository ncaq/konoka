/**
 * PRレビューを一括投稿するモジュール。
 * レビュー本文とインラインコメントを1回のAPI呼び出しで投稿します。
 */

import { Schema } from "effect";
import type { Octokit } from "octokit";

const DiffSideSchema = Schema.Literal("LEFT", "RIGHT");

const ReviewLevelSchema = Schema.Literal("CAUTION", "WARNING", "IMPORTANT", "TIP", "NOTE");

const ReviewTagSchema = Schema.Literal(
  "code-quality",
  "dependency",
  "documentation",
  "performance",
  "security",
  "test",
);

const ReviewCommentSchema = Schema.Struct({
  path: Schema.NonEmptyString,
  body: Schema.NonEmptyString,
  line: Schema.Number.pipe(Schema.int(), Schema.positive()),
  startLine: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.positive()), { exact: true }),
  side: Schema.optionalWith(DiffSideSchema, { exact: true }),
  level: ReviewLevelSchema,
  tags: Schema.Array(ReviewTagSchema),
});

const ReviewEventSchema = Schema.Literal("APPROVE", "COMMENT", "REQUEST_CHANGES");

/** レビュー投稿の入力スキーマ。 */
const ReviewSubmissionSchema = Schema.Struct({
  owner: Schema.NonEmptyString,
  repo: Schema.NonEmptyString,
  prNumber: Schema.Number.pipe(Schema.int(), Schema.positive()),
  headCommitId: Schema.optionalWith(Schema.NonEmptyString, { exact: true }),
  event: ReviewEventSchema,
  body: Schema.NonEmptyString,
  comments: Schema.optionalWith(Schema.Array(ReviewCommentSchema), { exact: true }),
});

/** レビュー投稿の入力。 */
type ReviewSubmission = typeof ReviewSubmissionSchema.Type;

/** レビュー投稿の結果。 */
interface ReviewSubmissionResult {
  readonly reviewId: number;
  readonly htmlUrl: string;
}

const reviewTagLabel: Record<typeof ReviewTagSchema.Type, string> = {
  "code-quality": "🧹 Code Quality",
  dependency: "📦 Dependency",
  documentation: "📚 Documentation",
  performance: "⚡ Performance",
  security: "🔒 Security",
  test: "🧪 Test",
};

function quoteAlertLine(line: string): string {
  return `> ${line}`;
}

function formatReviewCommentBody(comment: typeof ReviewCommentSchema.Type): string {
  const tagLabel =
    comment.tags.length > 0 ? `${quoteAlertLine(comment.tags.map((tag) => reviewTagLabel[tag]).join(" "))}\n` : "";
  return `> [!${comment.level}]\n${tagLabel}\n${comment.body}`;
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
 * レビューイベントは入力の`event`フィールドで指定します。
 */
export async function submitReview(octokit: Octokit, submission: ReviewSubmission): Promise<ReviewSubmissionResult> {
  const response = await octokit.rest.pulls.createReview({
    owner: submission.owner,
    repo: submission.repo,
    pull_number: submission.prNumber,
    ...(submission.headCommitId != null ? { commit_id: submission.headCommitId } : {}),
    event: submission.event,
    body: submission.body,
    comments:
      submission.comments?.map((c) => ({
        path: c.path,
        body: formatReviewCommentBody(c),
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
