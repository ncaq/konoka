import type { Octokit } from "octokit";
import { describe, expect, test, vi } from "vitest";
import { decodeReviewSubmission, submitReview } from "../src/submit-review.js";

/** テスト用の最小限の有効な入力。 */
const validInput = {
  owner: "test-owner",
  repo: "test-repo",
  prNumber: 42,
  body: "review body",
};

describe("decodeReviewSubmission", () => {
  test("最小限の有効な入力をデコードできる", () => {
    const submission = decodeReviewSubmission(JSON.stringify(validInput));

    expect(submission.owner).toBe("test-owner");
    expect(submission.repo).toBe("test-repo");
    expect(submission.prNumber).toBe(42);
    expect(submission.body).toBe("review body");
    expect(submission.comments).toBeUndefined();
    expect(submission.headCommitId).toBeUndefined();
  });

  test("全フィールドを含む入力をデコードできる", () => {
    const input = {
      ...validInput,
      headCommitId: "abc123def456",
      comments: [
        {
          path: "src/foo.ts",
          body: "fix this",
          line: 10,
          level: "high",
        },
        {
          path: "src/bar.ts",
          body: "multi-line comment",
          line: 20,
          startLine: 15,
          side: "LEFT",
          level: "low",
        },
      ],
    };
    const submission = decodeReviewSubmission(JSON.stringify(input));

    expect(submission.headCommitId).toBe("abc123def456");
    expect(submission.comments).toHaveLength(2);
    expect(submission.comments?.[0]?.path).toBe("src/foo.ts");
    expect(submission.comments?.[0]?.side).toBeUndefined();
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
    expect(() => decodeReviewSubmission(JSON.stringify({ ...validInput, prNumber: 1.5 }))).toThrow();
  });

  test("コメントのlineが0の場合はエラーになる", () => {
    const input = {
      ...validInput,
      comments: [{ path: "a.ts", body: "x", line: 0, level: "info" }],
    };
    expect(() => decodeReviewSubmission(JSON.stringify(input))).toThrow();
  });

  test("コメントのpathが空文字の場合はエラーになる", () => {
    const input = {
      ...validInput,
      comments: [{ path: "", body: "x", line: 1, level: "info" }],
    };
    expect(() => decodeReviewSubmission(JSON.stringify(input))).toThrow();
  });

  test("不正なlevelはエラーになる", () => {
    const input = {
      ...validInput,
      comments: [{ path: "a.ts", body: "x", line: 1, level: "unknown" }],
    };
    expect(() => decodeReviewSubmission(JSON.stringify(input))).toThrow();
  });

  test("不正なsideはエラーになる", () => {
    const input = {
      ...validInput,
      comments: [{ path: "a.ts", body: "x", line: 1, level: "info", side: "CENTER" }],
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
      comments: [{ path: "a.ts", body: "x", line: 1, level: "info", unknownField: "unexpected" }],
    };
    expect(() => decodeReviewSubmission(JSON.stringify(input))).toThrow();
  });
});

describe("submitReview", () => {
  function createMockOctokit(): Octokit {
    return {
      rest: {
        pulls: {
          createReview: vi.fn().mockResolvedValue({
            data: {
              id: 999,
              html_url: "https://github.com/test-owner/test-repo/pull/42#pullrequestreview-999",
            },
          }),
        },
      },
    } as unknown as Octokit;
  }

  test("コメントなしの場合はAPPROVEになる", async () => {
    const octokit = createMockOctokit();
    const submission = decodeReviewSubmission(JSON.stringify(validInput));
    await submitReview(octokit, submission);

    const call = vi.mocked(octokit.rest.pulls.createReview).mock.calls[0]?.[0];
    expect(call?.event).toBe("APPROVE");
  });

  test("criticalコメントがある場合はREQUEST_CHANGESになる", async () => {
    const octokit = createMockOctokit();
    const input = {
      ...validInput,
      comments: [
        { path: "a.ts", body: "ok", line: 1, level: "low" },
        { path: "b.ts", body: "danger", line: 2, level: "critical" },
      ],
    };
    const submission = decodeReviewSubmission(JSON.stringify(input));
    await submitReview(octokit, submission);

    const call = vi.mocked(octokit.rest.pulls.createReview).mock.calls[0]?.[0];
    expect(call?.event).toBe("REQUEST_CHANGES");
  });

  test("low/infoのみの場合はAPPROVEになる", async () => {
    const octokit = createMockOctokit();
    const input = {
      ...validInput,
      comments: [
        { path: "a.ts", body: "nit", line: 1, level: "low" },
        { path: "b.ts", body: "fyi", line: 2, level: "info" },
      ],
    };
    const submission = decodeReviewSubmission(JSON.stringify(input));
    await submitReview(octokit, submission);

    const call = vi.mocked(octokit.rest.pulls.createReview).mock.calls[0]?.[0];
    expect(call?.event).toBe("APPROVE");
  });

  test("medium以上でcritical未満の場合はCOMMENTになる", async () => {
    const octokit = createMockOctokit();
    const input = {
      ...validInput,
      comments: [{ path: "a.ts", body: "concern", line: 1, level: "medium" }],
    };
    const submission = decodeReviewSubmission(JSON.stringify(input));
    await submitReview(octokit, submission);

    const call = vi.mocked(octokit.rest.pulls.createReview).mock.calls[0]?.[0];
    expect(call?.event).toBe("COMMENT");
  });

  test("highのみの場合はCOMMENTになる", async () => {
    const octokit = createMockOctokit();
    const input = {
      ...validInput,
      comments: [{ path: "a.ts", body: "issue", line: 1, level: "high" }],
    };
    const submission = decodeReviewSubmission(JSON.stringify(input));
    await submitReview(octokit, submission);

    const call = vi.mocked(octokit.rest.pulls.createReview).mock.calls[0]?.[0];
    expect(call?.event).toBe("COMMENT");
  });

  test("headCommitIdが指定されている場合はcommit_idが渡される", async () => {
    const octokit = createMockOctokit();
    const input = { ...validInput, headCommitId: "sha256abc" };
    const submission = decodeReviewSubmission(JSON.stringify(input));
    await submitReview(octokit, submission);

    const call = vi.mocked(octokit.rest.pulls.createReview).mock.calls[0]?.[0];
    expect(call?.commit_id).toBe("sha256abc");
  });

  test("headCommitIdが未指定の場合はcommit_idが渡されない", async () => {
    const octokit = createMockOctokit();
    const submission = decodeReviewSubmission(JSON.stringify(validInput));
    await submitReview(octokit, submission);

    const call = vi.mocked(octokit.rest.pulls.createReview).mock.calls[0]?.[0];
    expect(call).not.toHaveProperty("commit_id");
  });

  test("single lineコメントのパラメータが正しく変換される", async () => {
    const octokit = createMockOctokit();
    const input = {
      ...validInput,
      comments: [{ path: "src/foo.ts", body: "fix", line: 42, level: "medium" }],
    };
    const submission = decodeReviewSubmission(JSON.stringify(input));
    await submitReview(octokit, submission);

    const call = vi.mocked(octokit.rest.pulls.createReview).mock.calls[0]?.[0];
    const comment = call?.comments?.[0];
    expect(comment).toEqual({
      path: "src/foo.ts",
      body: "fix",
      line: 42,
      side: "RIGHT",
    });
  });

  test("multi-lineコメントのパラメータが正しく変換される", async () => {
    const octokit = createMockOctokit();
    const input = {
      ...validInput,
      comments: [{ path: "src/bar.ts", body: "refactor", line: 20, startLine: 10, side: "LEFT", level: "low" }],
    };
    const submission = decodeReviewSubmission(JSON.stringify(input));
    await submitReview(octokit, submission);

    const call = vi.mocked(octokit.rest.pulls.createReview).mock.calls[0]?.[0];
    const comment = call?.comments?.[0];
    expect(comment).toEqual({
      path: "src/bar.ts",
      body: "refactor",
      line: 20,
      start_line: 10,
      side: "LEFT",
      start_side: "LEFT",
    });
  });

  test("startLine指定でsideが未指定の場合はstart_sideもRIGHTになる", async () => {
    const octokit = createMockOctokit();
    const input = {
      ...validInput,
      comments: [{ path: "src/foo.ts", body: "x", line: 20, startLine: 10, level: "low" }],
    };
    const submission = decodeReviewSubmission(JSON.stringify(input));
    await submitReview(octokit, submission);
    const call = vi.mocked(octokit.rest.pulls.createReview).mock.calls[0]?.[0];
    expect(call?.comments?.[0]).toEqual({
      path: "src/foo.ts",
      body: "x",
      line: 20,
      start_line: 10,
      side: "RIGHT",
      start_side: "RIGHT",
    });
  });

  test("結果にreviewIdとhtmlUrlが含まれる", async () => {
    const octokit = createMockOctokit();
    const submission = decodeReviewSubmission(JSON.stringify(validInput));
    const submissionResult = await submitReview(octokit, submission);

    expect(submissionResult.reviewId).toBe(999);
    expect(submissionResult.htmlUrl).toBe("https://github.com/test-owner/test-repo/pull/42#pullrequestreview-999");
  });
});
