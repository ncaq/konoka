import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { type CommentLineProblem, validateCommentLines } from "../src/review-comment-lines";
import type { ReviewCommentSchema } from "../src/review-schema";
import { parseUnifiedDiff } from "../src/unified-diff";
import { diffLines } from "./diff-lines";

type ReviewComment = typeof ReviewCommentSchema.Type;

/**
 * `src/foo.ts`は新28〜32行目(旧28〜31行目)と新101〜103行目、
 * `src/bar.ts`は削除のみ、`old.ts`→`new.ts`はリネームのみ、`image.png`はバイナリ。
 */
const files = parseUnifiedDiff(
  diffLines(
    "diff --git a/src/foo.ts b/src/foo.ts",
    "--- a/src/foo.ts",
    "+++ b/src/foo.ts",
    "@@ -28,4 +28,5 @@ function foo() {",
    " function foo() {",
    "   const a = 1;",
    "-  const foo = baz();",
    "+  const foo = bar();",
    "+  const baz = qux();",
    "   return foo;",
    "@@ -100,3 +101,3 @@",
    " before",
    "-old",
    "+new",
    " after",
    "diff --git a/src/bar.ts b/src/bar.ts",
    "deleted file mode 100644",
    "--- a/src/bar.ts",
    "+++ /dev/null",
    "@@ -1,2 +0,0 @@",
    "-a",
    "-b",
    "diff --git a/old.ts b/new.ts",
    "similarity index 100%",
    "rename from old.ts",
    "rename to new.ts",
    "diff --git a/image.png b/image.png",
    "Binary files a/image.png and b/image.png differ",
  ),
);

function comment(
  partial: Partial<ReviewComment> & Pick<ReviewComment, "path" | "line">,
): ReviewComment {
  return { body: "x", level: "NOTE", tags: [], ...partial };
}

function problemsOf(
  comments: readonly ReviewComment[],
): Effect.Effect<readonly CommentLineProblem[]> {
  return validateCommentLines(files, comments).pipe(
    Effect.map(() => []),
    Effect.catch((error) => Effect.succeed(error.problems)),
  );
}

describe("validateCommentLines", () => {
  it.effect("hunk内の行なら通る", () =>
    Effect.gen(function* () {
      const problems = yield* problemsOf([
        comment({ path: "src/foo.ts", line: 30 }), // 追加行
        comment({ path: "src/foo.ts", line: 32 }), // 文脈行
        comment({ path: "src/foo.ts", line: 30, side: "LEFT" }), // 削除行
        comment({ path: "src/foo.ts", line: 31, side: "LEFT" }), // 旧側の文脈行
        comment({ path: "src/foo.ts", line: 32, startLine: 28 }),
        comment({ path: "src/foo.ts", line: 30, startLine: 28, side: "LEFT" }),
        comment({ path: "src/bar.ts", line: 2, side: "LEFT" }),
      ]);
      expect(problems).toEqual([]);
    }),
  );

  it.effect("コメントが無ければ通る", () =>
    Effect.gen(function* () {
      expect(yield* problemsOf([])).toEqual([]);
    }),
  );

  it.effect("パッチファイル内の行番号を入れた場合はhunk外として範囲一覧付きで報告する", () =>
    Effect.gen(function* () {
      const [problem] = yield* problemsOf([comment({ path: "src/foo.ts", line: 10 })]);
      expect(problem).toMatchObject({
        index: 0,
        comment: { path: "src/foo.ts", line: 10 },
        side: "RIGHT",
        reason: { _tag: "LineOutsideHunk" },
        commentableRanges: [
          { header: "@@ -28,4 +28,5 @@ function foo() {", start: 28, end: 32 },
          { header: "@@ -100,3 +101,3 @@", start: 101, end: 103 },
        ],
      });
    }),
  );

  it.effect("sideが差分の側と合わない場合はhunk外になる", () =>
    Effect.gen(function* () {
      const problems = yield* problemsOf([
        comment({ path: "src/bar.ts", line: 1 }), // 削除のみのファイルにRIGHT
        comment({ path: "src/foo.ts", line: 103, side: "LEFT" }), // 旧側は100〜102
      ]);
      expect(problems.map((problem) => problem.reason._tag)).toEqual([
        "NoCommentableLines",
        "LineOutsideHunk",
      ]);
    }),
  );

  it.effect("差分に無いパスは似たパスを添え、リネーム元なら新しいパスを示す", () =>
    Effect.gen(function* () {
      const problems = yield* problemsOf([
        comment({ path: "plugins/kyosei/src/foo.ts", line: 30 }),
        comment({ path: "src/missing.ts", line: 1 }),
        comment({ path: "old.ts", line: 1 }),
      ]);
      expect(problems.map((problem) => problem.reason)).toEqual([
        { _tag: "PathNotInDiff", similarPaths: ["src/foo.ts"] },
        { _tag: "PathNotInDiff", similarPaths: [] },
        { _tag: "PathRenamed", renamedTo: "new.ts" },
      ]);
    }),
  );

  it.effect("バイナリとhunkの無いファイルには付けられない", () =>
    Effect.gen(function* () {
      const problems = yield* problemsOf([
        comment({ path: "image.png", line: 1 }),
        comment({ path: "new.ts", line: 1 }),
      ]);
      expect(problems.map((problem) => problem.reason._tag)).toEqual([
        "BinaryFile",
        "NoCommentableLines",
      ]);
    }),
  );

  it.effect("startLineの不正を種類ごとに報告する", () =>
    Effect.gen(function* () {
      const problems = yield* problemsOf([
        comment({ path: "src/foo.ts", line: 30, startLine: 30 }),
        comment({ path: "src/foo.ts", line: 30, startLine: 5 }),
        comment({ path: "src/foo.ts", line: 102, startLine: 30 }),
        comment({ path: "src/foo.ts", line: 101, startLine: 30, side: "LEFT" }),
      ]);
      expect(problems.map((problem) => problem.reason)).toEqual([
        { _tag: "StartLineNotBeforeLine" },
        { _tag: "StartLineOutsideHunk" },
        {
          _tag: "RangeSpansHunks",
          startHeader: "@@ -28,4 +28,5 @@ function foo() {",
          endHeader: "@@ -100,3 +101,3 @@",
        },
        {
          _tag: "RangeSpansHunks",
          startHeader: "@@ -28,4 +28,5 @@ function foo() {",
          endHeader: "@@ -100,3 +101,3 @@",
        },
      ]);
    }),
  );

  it.effect("不正なコメントを全件まとめ、LLMが直せる案内を含むメッセージにする", () =>
    Effect.gen(function* () {
      const error = yield* validateCommentLines(files, [
        comment({ path: "src/foo.ts", line: 10 }),
        comment({ path: "src/foo.ts", line: 30 }),
        comment({ path: "plugins/kyosei/src/foo.ts", line: 1 }),
        comment({ path: "src/missing.ts", line: 1 }),
      ]).pipe(Effect.flip);
      expect(error.problems.map((problem) => problem.index)).toEqual([0, 2, 3]);
      expect(error.totalComments).toBe(4);
      expect(error.message).toMatchInlineSnapshot(`
        "invalid inline comment lines: 3 of 4 comments cannot be resolved against the patch

        comments[0]: path="src/foo.ts" side=RIGHT line=10
          reason: line is not inside any hunk of this file on side RIGHT
          commentable lines (RIGHT) in src/foo.ts:
            28-32  @@ -28,4 +28,5 @@ function foo() {
            101-103  @@ -100,3 +101,3 @@

        comments[2]: path="plugins/kyosei/src/foo.ts" side=RIGHT line=1
          reason: path is not present in the patch
          did you mean: src/foo.ts

        comments[3]: path="src/missing.ts" side=RIGHT line=1
          reason: path is not present in the patch

        how to fix:
          \`line\`と\`startLine\`には、パッチファイル(changeset.patch)内の行番号ではなく、
          対象ファイル自体の行番号を指定してください。
          changeset.patchではhunk内の各行の先頭にその番号が付いています。
          削除行(-)に付いている番号は旧ファイルの行番号なので、その行への指摘には\`"side": "LEFT"\`が必要です。
          追加行(+)と文脈行に付いている番号は新ファイルの行番号で、\`side\`は省略(RIGHT)できます。
          複数行コメントはstartLine < lineで、両方が同じhunkに含まれている必要があります。
          上の範囲内に収められない指摘はcommentsから外し、レビュー本文(body)に書いてください。"
      `);
    }),
  );
});
