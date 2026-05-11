/**
 * PRレビューのインラインコメント本文を組み立てるモジュール。
 * タグラベルとGitHub Alertフォーマットを適用します。
 */

import type { ReviewCommentSchema, ReviewTagSchema } from "./review-schema";

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

/** GitHub Alert形式とタグラベルを付与したコメント本文を生成します。 */
export function formatReviewCommentBody(comment: typeof ReviewCommentSchema.Type): string {
  const tagLabel =
    comment.tags.length > 0
      ? `${quoteAlertLine(comment.tags.map((tag) => reviewTagLabel[tag]).join(" "))}\n`
      : "";
  return `> [!${comment.level}]\n${tagLabel}\n${comment.body}`;
}
