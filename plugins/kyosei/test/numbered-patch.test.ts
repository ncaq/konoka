import { describe, expect, test } from "vitest";
import { numberDiff } from "../src/numbered-patch";
import { diffLines } from "./diff-lines";

describe("numberDiff", () => {
  test("削除行には旧ファイル、追加行と文脈行には新ファイルの行番号を付ける", () => {
    const diff = diffLines(
      "diff --git a/src/foo.ts b/src/foo.ts",
      "index 1234567..89abcde 100644",
      "--- a/src/foo.ts",
      "+++ b/src/foo.ts",
      "@@ -28,4 +28,5 @@ function foo() {",
      " function foo() {",
      "   const a = 1;",
      "-  const foo = baz();",
      "+  const foo = bar();",
      "+  const baz = qux();",
      "   return foo;",
    );
    expect(numberDiff(diff)).toBe(
      diffLines(
        "diff --git a/src/foo.ts b/src/foo.ts",
        "index 1234567..89abcde 100644",
        "--- a/src/foo.ts",
        "+++ b/src/foo.ts",
        "@@ -28,4 +28,5 @@ function foo() {",
        "  28  function foo() {",
        "  29    const a = 1;",
        "  30 -  const foo = baz();",
        "  30 +  const foo = bar();",
        "  31 +  const baz = qux();",
        "  32    return foo;",
      ),
    );
  });

  test("行数の省略されたhunkヘッダも扱える", () => {
    expect(numberDiff(diffLines("@@ -1 +1 @@", "-x", "+y"))).toBe(
      diffLines("@@ -1 +1 @@", "   1 -x", "   1 +y"),
    );
  });

  test("新規ファイルと削除ファイルに行番号を付ける", () => {
    expect(
      numberDiff(
        diffLines(
          "--- /dev/null",
          "+++ b/new.ts",
          "@@ -0,0 +1,2 @@",
          "+a",
          "+b",
          "--- a/gone.ts",
          "+++ /dev/null",
          "@@ -1,2 +0,0 @@",
          "-a",
          "-b",
        ),
      ),
    ).toBe(
      diffLines(
        "--- /dev/null",
        "+++ b/new.ts",
        "@@ -0,0 +1,2 @@",
        "   1 +a",
        "   2 +b",
        "--- a/gone.ts",
        "+++ /dev/null",
        "@@ -1,2 +0,0 @@",
        "   1 -a",
        "   2 -b",
      ),
    );
  });

  test("`\\ No newline at end of file`は加工せず行番号も進めない", () => {
    expect(
      numberDiff(
        diffLines(
          "@@ -1,2 +1,2 @@",
          " keep",
          "-old",
          "\\ No newline at end of file",
          "+new",
          "\\ No newline at end of file",
        ),
      ),
    ).toBe(
      diffLines(
        "@@ -1,2 +1,2 @@",
        "   1  keep",
        "   2 -old",
        "\\ No newline at end of file",
        "   2 +new",
        "\\ No newline at end of file",
      ),
    );
  });

  test("複数ファイルと複数hunkでそれぞれのヘッダから数え直す", () => {
    expect(
      numberDiff(
        diffLines(
          "diff --git a/a.ts b/a.ts",
          "--- a/a.ts",
          "+++ b/a.ts",
          "@@ -1 +1 @@",
          "-x",
          "+y",
          "@@ -50,2 +50,2 @@",
          " keep",
          "-x",
          "+y",
          "diff --git a/b.ts b/b.ts",
          "--- a/b.ts",
          "+++ b/b.ts",
          "@@ -7 +7 @@",
          "-x",
          "+y",
        ),
      ),
    ).toBe(
      diffLines(
        "diff --git a/a.ts b/a.ts",
        "--- a/a.ts",
        "+++ b/a.ts",
        "@@ -1 +1 @@",
        "   1 -x",
        "   1 +y",
        "@@ -50,2 +50,2 @@",
        "  50  keep",
        "  51 -x",
        "  51 +y",
        "diff --git a/b.ts b/b.ts",
        "--- a/b.ts",
        "+++ b/b.ts",
        "@@ -7 +7 @@",
        "   7 -x",
        "   7 +y",
      ),
    );
  });

  test("リネームのみやバイナリは入力のまま", () => {
    const renameOnly = diffLines(
      "diff --git a/old.ts b/new.ts",
      "similarity index 100%",
      "rename from old.ts",
      "rename to new.ts",
    );
    const binary = diffLines(
      "diff --git a/image.png b/image.png",
      "Binary files a/image.png and b/image.png differ",
    );
    expect(numberDiff(renameOnly)).toBe(renameOnly);
    expect(numberDiff(binary)).toBe(binary);
  });

  test("空文字列は空文字列", () => {
    expect(numberDiff("")).toBe("");
  });

  test("末尾改行の有無を保つ", () => {
    expect(numberDiff("@@ -1 +1 @@\n-x\n+y")).toBe("@@ -1 +1 @@\n   1 -x\n   1 +y");
  });

  test("行番号の幅はdiff全体の最大行番号に合わせて揃える", () => {
    expect(
      numberDiff(diffLines("@@ -1 +1 @@", "-x", "+y", "@@ -12345 +12345 @@", "-x", "+y")),
    ).toBe(
      diffLines(
        "@@ -1 +1 @@",
        "    1 -x",
        "    1 +y",
        "@@ -12345 +12345 @@",
        "12345 -x",
        "12345 +y",
      ),
    );
  });

  test("先頭の空白が落ちた空の文脈行にも行番号を付ける", () => {
    expect(numberDiff(diffLines("@@ -1,3 +1,3 @@", " first", "", "-old", "+new"))).toBe(
      diffLines("@@ -1,3 +1,3 @@", "   1  first", "   2 ", "   3 -old", "   3 +new"),
    );
  });

  test("行数が合わない壊れたdiffでも例外にならず残りは加工しない", () => {
    expect(
      numberDiff(diffLines("@@ -1,5 +1,5 @@", " only one line", "diff --git a/b.ts b/b.ts")),
    ).toBe(diffLines("@@ -1,5 +1,5 @@", "   1  only one line", "diff --git a/b.ts b/b.ts"));
  });
});
