import { describe, expect, test } from "vitest";
import { decodeReviewSubmission } from "../src/review-decoder";

/** テスト用の最小限の有効な入力。 */
const validInput = {
  owner: "test-owner",
  repo: "test-repo",
  prNumber: 42,
  event: "APPROVE",
  body: "review body",
  headCommitId: "0123456789abcdef0123456789abcdef01234567",
};

describe("decodeReviewSubmission", () => {
  test("最小限の有効な入力をデコードできる", () => {
    const submission = decodeReviewSubmission(JSON.stringify(validInput));

    expect(submission.owner).toBe("test-owner");
    expect(submission.repo).toBe("test-repo");
    expect(submission.prNumber).toBe(42);
    expect(submission.event).toBe("APPROVE");
    expect(submission.body).toBe("review body");
    expect(submission.comments).toBeUndefined();
    expect(submission.headCommitId).toBe("0123456789abcdef0123456789abcdef01234567");
  });

  test("headCommitIdが省略されている場合はエラーになる", () => {
    const { headCommitId: _omit, ...inputWithoutCommit } = validInput;
    expect(() => decodeReviewSubmission(JSON.stringify(inputWithoutCommit))).toThrow();
  });

  test("headCommitIdがSHA形式でない場合はエラーになる", () => {
    expect(() =>
      decodeReviewSubmission(JSON.stringify({ ...validInput, headCommitId: "not-a-sha" })),
    ).toThrow();
  });

  test("全フィールドを含む入力をデコードできる", () => {
    const input = {
      ...validInput,
      event: "REQUEST_CHANGES",
      headCommitId: "abc123def456",
      comments: [
        {
          path: "src/foo.ts",
          body: "fix this",
          line: 10,
          level: "WARNING",
          tags: ["code-quality"],
        },
        {
          path: "src/bar.ts",
          body: "multi-line comment",
          line: 20,
          startLine: 15,
          side: "LEFT",
          level: "TIP",
          tags: ["test"],
        },
      ],
    };
    const submission = decodeReviewSubmission(JSON.stringify(input));

    expect(submission.event).toBe("REQUEST_CHANGES");
    expect(submission.headCommitId).toBe("abc123def456");
    expect(submission.comments).toHaveLength(2);
    expect(submission.comments?.[0]?.path).toBe("src/foo.ts");
    expect(submission.comments?.[0]?.side).toBeUndefined();
    expect(submission.comments?.[0]?.tags).toEqual(["code-quality"]);
    expect(submission.comments?.[1]?.startLine).toBe(15);
    expect(submission.comments?.[1]?.side).toBe("LEFT");
  });

  test("JSONとして不正な文字列はエラーになる", () => {
    expect(() => decodeReviewSubmission("not json")).toThrow();
  });

  test("ownerが空文字の場合はエラーになる", () => {
    expect(() => decodeReviewSubmission(JSON.stringify({ ...validInput, owner: "" }))).toThrow();
  });

  test("repoが空文字の場合はエラーになる", () => {
    expect(() => decodeReviewSubmission(JSON.stringify({ ...validInput, repo: "" }))).toThrow();
  });

  test("bodyが空文字の場合はエラーになる", () => {
    expect(() => decodeReviewSubmission(JSON.stringify({ ...validInput, body: "" }))).toThrow();
  });

  test("prNumberが0の場合はエラーになる", () => {
    expect(() => decodeReviewSubmission(JSON.stringify({ ...validInput, prNumber: 0 }))).toThrow();
  });

  test("prNumberが負の場合はエラーになる", () => {
    expect(() => decodeReviewSubmission(JSON.stringify({ ...validInput, prNumber: -1 }))).toThrow();
  });

  test("prNumberが小数の場合はエラーになる", () => {
    expect(() =>
      decodeReviewSubmission(JSON.stringify({ ...validInput, prNumber: 1.5 })),
    ).toThrow();
  });

  test("コメントのlineが0の場合はエラーになる", () => {
    const input = {
      ...validInput,
      comments: [{ path: "a.ts", body: "x", line: 0, level: "NOTE", tags: [] }],
    };
    expect(() => decodeReviewSubmission(JSON.stringify(input))).toThrow();
  });

  test("コメントのpathが空文字の場合はエラーになる", () => {
    const input = {
      ...validInput,
      comments: [{ path: "", body: "x", line: 1, level: "NOTE", tags: [] }],
    };
    expect(() => decodeReviewSubmission(JSON.stringify(input))).toThrow();
  });

  test("不正なlevelはエラーになる", () => {
    const input = {
      ...validInput,
      comments: [{ path: "a.ts", body: "x", line: 1, level: "unknown", tags: [] }],
    };
    expect(() => decodeReviewSubmission(JSON.stringify(input))).toThrow();
  });

  test("不正なtagはエラーになる", () => {
    const input = {
      ...validInput,
      comments: [{ path: "a.ts", body: "x", line: 1, level: "NOTE", tags: ["unknown"] }],
    };
    expect(() => decodeReviewSubmission(JSON.stringify(input))).toThrow();
  });

  test("コメントのtagsが欠落している場合はエラーになる", () => {
    const input = {
      ...validInput,
      comments: [{ path: "a.ts", body: "x", line: 1, level: "NOTE" }],
    };
    expect(() => decodeReviewSubmission(JSON.stringify(input))).toThrow();
  });

  test("eventが欠落している場合はエラーになる", () => {
    const { event: _, ...inputWithoutEvent } = validInput;
    expect(() => decodeReviewSubmission(JSON.stringify(inputWithoutEvent))).toThrow();
  });

  test("不正なeventはエラーになる", () => {
    expect(() =>
      decodeReviewSubmission(JSON.stringify({ ...validInput, event: "INVALID" })),
    ).toThrow();
  });

  test("不正なsideはエラーになる", () => {
    const input = {
      ...validInput,
      comments: [{ path: "a.ts", body: "x", line: 1, level: "NOTE", tags: [], side: "CENTER" }],
    };
    expect(() => decodeReviewSubmission(JSON.stringify(input))).toThrow();
  });

  test("トップレベルに未知のプロパティがある場合はエラーになる", () => {
    const input = { ...validInput, unknownField: "unexpected" };
    expect(() => decodeReviewSubmission(JSON.stringify(input))).toThrow();
  });

  test("コメントに未知のプロパティがある場合はエラーになる", () => {
    const input = {
      ...validInput,
      comments: [
        { path: "a.ts", body: "x", line: 1, level: "NOTE", tags: [], unknownField: "unexpected" },
      ],
    };
    expect(() => decodeReviewSubmission(JSON.stringify(input))).toThrow();
  });
});
