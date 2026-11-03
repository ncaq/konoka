import { Option } from "effect";
import { describe, expect, test } from "vitest";
import { numberDiff } from "../src/numbered-patch";
import {
  type DiffFile,
  type DiffHunk,
  parseHunkHeader,
  parseNumberedDiff,
  parseUnifiedDiff,
} from "../src/unified-diff";
import { diffLines } from "./diff-lines";

/** テキストファイルのhunk一覧。バイナリなら空。 */
function hunksOf(file: DiffFile | undefined): readonly DiffHunk[] {
  return file?.content.kind === "text" ? file.content.hunks : [];
}

const modifiedFileDiff = diffLines(
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
  "@@ -100,3 +101,3 @@",
  " before",
  "-old",
  "+new",
  " after",
);

describe("parseHunkHeader", () => {
  test("`@@ -a,b +c,d @@`の数値を読み取る", () => {
    expect(parseHunkHeader("@@ -28,4 +28,5 @@ function foo() {")).toEqual(
      Option.some({ oldStart: 28, oldLines: 4, newStart: 28, newLines: 5 }),
    );
  });

  test("行数の省略は1として扱う", () => {
    expect(parseHunkHeader("@@ -1 +1 @@")).toEqual(
      Option.some({ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1 }),
    );
  });

  test("hunkヘッダでなければ`none`", () => {
    expect(parseHunkHeader("@@ broken")).toEqual(Option.none());
    expect(parseHunkHeader("--- a/foo")).toEqual(Option.none());
  });
});

describe("parseUnifiedDiff", () => {
  test("複数hunkの各行に旧・新の行番号を付ける", () => {
    const files = parseUnifiedDiff(modifiedFileDiff);
    expect(files).toHaveLength(1);
    const [file] = files;
    expect(file).toMatchObject({ kind: "modified", path: "src/foo.ts" });
    const [first, second] = hunksOf(file);
    expect(first?.header).toBe("@@ -28,4 +28,5 @@ function foo() {");
    expect(first?.lines).toEqual([
      { kind: "context", content: "function foo() {", oldLine: 28, newLine: 28 },
      { kind: "context", content: "  const a = 1;", oldLine: 29, newLine: 29 },
      { kind: "delete", content: "  const foo = baz();", oldLine: 30 },
      { kind: "add", content: "  const foo = bar();", newLine: 30 },
      { kind: "add", content: "  const baz = qux();", newLine: 31 },
      { kind: "context", content: "  return foo;", oldLine: 31, newLine: 32 },
    ]);
    expect(second).toEqual({
      oldStart: 100,
      oldLines: 3,
      newStart: 101,
      newLines: 3,
      header: "@@ -100,3 +101,3 @@",
      lines: [
        { kind: "context", content: "before", oldLine: 100, newLine: 101 },
        { kind: "delete", content: "old", oldLine: 101 },
        { kind: "add", content: "new", newLine: 102 },
        { kind: "context", content: "after", oldLine: 102, newLine: 103 },
      ],
    });
  });

  test("新規ファイルは`added`で全行が追加行になる", () => {
    const files = parseUnifiedDiff(
      diffLines(
        "diff --git a/new.ts b/new.ts",
        "new file mode 100644",
        "--- /dev/null",
        "+++ b/new.ts",
        "@@ -0,0 +1,2 @@",
        "+export const a = 1;",
        "+export const b = 2;",
      ),
    );
    expect(files[0]).toMatchObject({ kind: "added", path: "new.ts" });
    expect(hunksOf(files[0])[0]?.lines).toEqual([
      { kind: "add", content: "export const a = 1;", newLine: 1 },
      { kind: "add", content: "export const b = 2;", newLine: 2 },
    ]);
  });

  test("削除ファイルは`deleted`で`path`は旧パスになる", () => {
    const files = parseUnifiedDiff(
      diffLines(
        "diff --git a/gone.ts b/gone.ts",
        "deleted file mode 100644",
        "--- a/gone.ts",
        "+++ /dev/null",
        "@@ -1,2 +0,0 @@",
        "-export const a = 1;",
        "-export const b = 2;",
      ),
    );
    expect(files[0]).toMatchObject({ kind: "deleted", path: "gone.ts" });
    expect(hunksOf(files[0])[0]?.lines).toEqual([
      { kind: "delete", content: "export const a = 1;", oldLine: 1 },
      { kind: "delete", content: "export const b = 2;", oldLine: 2 },
    ]);
  });

  test("内容変更を伴うリネームは`renamed`で新旧両方のパスを持つ", () => {
    const files = parseUnifiedDiff(
      diffLines(
        "diff --git a/old.ts b/new.ts",
        "similarity index 90%",
        "rename from old.ts",
        "rename to new.ts",
        "--- a/old.ts",
        "+++ b/new.ts",
        "@@ -1 +1 @@",
        "-x",
        "+y",
      ),
    );
    expect(files[0]).toMatchObject({ kind: "renamed", oldPath: "old.ts", path: "new.ts" });
    expect(hunksOf(files[0])).toHaveLength(1);
  });

  test("リネームのみは`rename from/to`からパスを取りhunkは空", () => {
    const files = parseUnifiedDiff(
      diffLines(
        "diff --git a/old.ts b/new.ts",
        "similarity index 100%",
        "rename from old.ts",
        "rename to new.ts",
      ),
    );
    expect(files).toEqual([
      { kind: "renamed", oldPath: "old.ts", path: "new.ts", content: { kind: "text", hunks: [] } },
    ]);
  });

  test("バイナリファイルは`content`が`binary`になる", () => {
    const files = parseUnifiedDiff(
      diffLines(
        "diff --git a/image.png b/image.png",
        "index 1234567..89abcde 100644",
        "Binary files a/image.png and b/image.png differ",
      ),
    );
    expect(files).toEqual([{ kind: "modified", path: "image.png", content: { kind: "binary" } }]);
  });

  test("`\\ No newline at end of file`は行として数えない", () => {
    const files = parseUnifiedDiff(
      diffLines(
        "diff --git a/a.txt b/a.txt",
        "--- a/a.txt",
        "+++ b/a.txt",
        "@@ -1,2 +1,2 @@",
        " keep",
        "-old",
        "\\ No newline at end of file",
        "+new",
        "\\ No newline at end of file",
        "@@ -10,1 +10,1 @@",
        "-x",
        "+y",
      ),
    );
    const [first, second] = hunksOf(files[0]);
    expect(first?.lines).toEqual([
      { kind: "context", content: "keep", oldLine: 1, newLine: 1 },
      { kind: "delete", content: "old", oldLine: 2 },
      { kind: "add", content: "new", newLine: 2 },
    ]);
    expect(second?.lines).toHaveLength(2);
  });

  test("`--- `で始まる削除行をファイルヘッダと誤認しない", () => {
    const files = parseUnifiedDiff(
      diffLines(
        "diff --git a/a.md b/a.md",
        "--- a/a.md",
        "+++ b/a.md",
        "@@ -1,2 +1,2 @@",
        "--- heading",
        "+++ heading",
        " body",
      ),
    );
    expect(files).toHaveLength(1);
    expect(hunksOf(files[0])[0]?.lines).toEqual([
      { kind: "delete", content: "-- heading", oldLine: 1 },
      { kind: "add", content: "++ heading", newLine: 1 },
      { kind: "context", content: "body", oldLine: 2, newLine: 2 },
    ]);
  });

  test("空白を含むパスと8進エスケープされた非ASCIIパスを復元する", () => {
    const files = parseUnifiedDiff(
      diffLines(
        'diff --git "a/\\343\\201\\202 b.ts" "b/\\343\\201\\202 b.ts"',
        '--- "a/\\343\\201\\202 b.ts"',
        '+++ "b/\\343\\201\\202 b.ts"',
        "@@ -1 +1 @@",
        "-x",
        "+y",
        "diff --git a/dir with space/c.ts b/dir with space/c.ts",
        "--- a/dir with space/c.ts",
        "+++ b/dir with space/c.ts",
        "@@ -1 +1 @@",
        "-x",
        "+y",
      ),
    );
    expect(files.map((file) => file.path)).toEqual(["あ b.ts", "dir with space/c.ts"]);
  });

  test("`diff --git`の無いplainなunified diffでも複数ファイルを区切れる", () => {
    const files = parseUnifiedDiff(
      diffLines(
        "--- a/first.ts\t2026-01-01",
        "+++ b/first.ts\t2026-01-02",
        "@@ -1 +1 @@",
        "-x",
        "+y",
        "--- a/second.ts",
        "+++ b/second.ts",
        "@@ -1 +1 @@",
        "-x",
        "+y",
      ),
    );
    expect(files.map((file) => file.path)).toEqual(["first.ts", "second.ts"]);
  });

  test("空文字列は空配列", () => {
    expect(parseUnifiedDiff("")).toEqual([]);
  });

  test("CRLFの改行でも解析できる", () => {
    const files = parseUnifiedDiff(modifiedFileDiff.replaceAll("\n", "\r\n"));
    expect(hunksOf(files[0])[0]?.lines[2]).toEqual({
      kind: "delete",
      content: "  const foo = baz();",
      oldLine: 30,
    });
  });

  test("行数が合わない壊れたdiffでも次のファイルへ進める", () => {
    const files = parseUnifiedDiff(
      diffLines(
        "diff --git a/a.ts b/a.ts",
        "--- a/a.ts",
        "+++ b/a.ts",
        "@@ -1,5 +1,5 @@",
        " only one line",
        "diff --git a/b.ts b/b.ts",
        "--- a/b.ts",
        "+++ b/b.ts",
        "@@ -1 +1 @@",
        "-x",
        "+y",
      ),
    );
    expect(files.map((file) => file.path)).toEqual(["a.ts", "b.ts"]);
    expect(hunksOf(files[1])[0]?.lines).toHaveLength(2);
  });
});

describe("parseNumberedDiff", () => {
  test("`numberDiff`の出力を読み戻すと生のdiffと同じ構造になる", () => {
    expect(parseNumberedDiff(numberDiff(modifiedFileDiff))).toEqual(
      parseUnifiedDiff(modifiedFileDiff),
    );
  });

  /**
   * 本文が「空白、数字、空白」や「数字、空白」で始まる行は、
   * 行番号の読み取りだけが成功してしまう恐れがある形です。
   * 行番号なしの分岐に戻れることを確かめます。
   */
  const digitLeadingDiff = diffLines(
    "diff --git a/numbers.txt b/numbers.txt",
    "--- a/numbers.txt",
    "+++ b/numbers.txt",
    "@@ -1,3 +1,3 @@",
    " 42 apples",
    "-7 pears",
    "+12 plums",
    "@@ -10,1 +10,1 @@",
    "-x",
    "+y",
  );

  test("行番号の付いていない生のdiffもベストエフォートで読める", () => {
    const parsed = parseNumberedDiff(digitLeadingDiff);
    expect(parsed).toEqual(parseUnifiedDiff(digitLeadingDiff));
    expect(hunksOf(parsed[0])).toHaveLength(2);
    expect(hunksOf(parsed[0])[0]?.lines).toEqual([
      { kind: "context", content: "42 apples", oldLine: 1, newLine: 1 },
      { kind: "delete", content: "7 pears", oldLine: 2 },
      { kind: "add", content: "12 plums", newLine: 2 },
    ]);
  });

  test("数字で始まる本文の行も行番号を付けて読み戻せる", () => {
    expect(parseNumberedDiff(numberDiff(digitLeadingDiff))).toEqual(
      parseUnifiedDiff(digitLeadingDiff),
    );
  });
});
