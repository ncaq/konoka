/**
 * PRレビューを一括投稿するモジュール。
 * レビュー本文とインラインコメントを1回のAPI呼び出しで投稿します。
 */

import { Schema } from "effect";
import type { Octokit } from "octokit";
import { mkBodyAppendMetadata } from "./review-metadata";
import {
  ReviewSubmissionSchema,
  type ReviewCommentSchema,
  type ReviewSubmissionResultSchema,
  type ReviewTagSchema,
} from "./review-schema";

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
export function decodeReviewSubmission(input: string): typeof ReviewSubmissionSchema.Type {
  return Schema.decodeUnknownSync(Schema.parseJson(ReviewSubmissionSchema), { onExcessProperty: "error" })(input);
}

/**
 * PRレビューを投稿します。
 * `octokit.rest.pulls.createReview`を使い、
 * レビュー本文とインラインコメントを1回のAPI呼び出しで一括投稿します。
 * レビューイベントは入力の`event`フィールドで指定します。
 */
export async function submitReview(
  octokit: Octokit,
  submission: typeof ReviewSubmissionSchema.Type,
): Promise<typeof ReviewSubmissionResultSchema.Type> {
  const response = await octokit.rest.pulls.createReview({
    owner: submission.owner,
    repo: submission.repo,
    pull_number: submission.prNumber,
    commit_id: submission.headCommitId,
    event: submission.event,
    body: await mkBodyAppendMetadata(submission),
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
    htmlUrl: new URL(response.data.html_url),
  };
}
