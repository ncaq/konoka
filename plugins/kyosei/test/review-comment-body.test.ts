import { describe, expect, test } from "vitest";
import { formatReviewCommentBody } from "../src/review-comment-body";
import type { ReviewCommentSchema } from "../src/review-schema";

/** テスト用の最小限の有効なコメント。`tags`は呼び出し側で上書きする想定。 */
const baseComment: typeof ReviewCommentSchema.Type = {
  path: "src/foo.ts",
  body: "fix this",
  line: 10,
  level: "NOTE",
  tags: [],
};

describe("formatReviewCommentBody", () => {
  test("tagsが空配列ならタグラベル行を出力しない", () => {
    const result = formatReviewCommentBody({ ...baseComment, level: "IMPORTANT", tags: [] });

    expect(result).toBe("> [!IMPORTANT]\n\nfix this");
  });

  test("単一tagはラベルが付与される", () => {
    const result = formatReviewCommentBody({
      ...baseComment,
      level: "WARNING",
      tags: ["security"],
    });

    expect(result).toBe("> [!WARNING]\n> 🔒 Security\n\nfix this");
  });

  test("複数tagは半角スペース区切りで連結される", () => {
    const result = formatReviewCommentBody({
      ...baseComment,
      level: "IMPORTANT",
      tags: ["security", "performance"],
    });

    expect(result).toBe("> [!IMPORTANT]\n> 🔒 Security ⚡ Performance\n\nfix this");
  });

  test.each([
    ["code-quality", "🧹 Code Quality"],
    ["dependency", "📦 Dependency"],
    ["documentation", "📚 Documentation"],
    ["performance", "⚡ Performance"],
    ["security", "🔒 Security"],
    ["test", "🧪 Test"],
  ] as const)("%sタグは%sにマップされる", (tag, label) => {
    const result = formatReviewCommentBody({ ...baseComment, tags: [tag] });

    expect(result).toBe(`> [!NOTE]\n> ${label}\n\nfix this`);
  });

  test.each(["CAUTION", "WARNING", "IMPORTANT", "TIP", "NOTE"] as const)(
    "レベル%sがGitHub Alertの種別にそのまま反映される",
    (level) => {
      const result = formatReviewCommentBody({ ...baseComment, level, tags: [] });

      expect(result.startsWith(`> [!${level}]\n`)).toBe(true);
    },
  );

  test("複数行のbodyがそのままAlert末尾に展開される", () => {
    const result = formatReviewCommentBody({
      ...baseComment,
      level: "CAUTION",
      tags: ["security"],
      body: "line 1\n\nline 3",
    });

    expect(result).toBe("> [!CAUTION]\n> 🔒 Security\n\nline 1\n\nline 3");
  });

  test("body内のMarkdown記号は加工されずそのまま含まれる", () => {
    const result = formatReviewCommentBody({
      ...baseComment,
      level: "NOTE",
      tags: [],
      body: "`code` and **bold**\n```ts\nconst x = 1;\n```",
    });

    expect(result).toBe("> [!NOTE]\n\n`code` and **bold**\n```ts\nconst x = 1;\n```");
  });
});
