import { it } from "@effect/vitest";
import { Effect } from "effect";
import type { Octokit } from "octokit";
import { describe, expect, test, vi } from "vitest";
import { decodeReviewSubmission } from "../src/review-decoder";
import { previewReview, submitReview } from "../src/review-poster";
import { fakeCommandExecutor } from "./fake-command";

const claudeFakeLayer = fakeCommandExecutor(() => Effect.fail(new Error("claude not installed in test environment")));

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
    expect(() => decodeReviewSubmission(JSON.stringify({ ...validInput, headCommitId: "not-a-sha" }))).toThrow();
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
    expect(() => decodeReviewSubmission(JSON.stringify({ ...validInput, prNumber: 1.5 }))).toThrow();
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
    expect(() => decodeReviewSubmission(JSON.stringify({ ...validInput, event: "INVALID" }))).toThrow();
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
      comments: [{ path: "a.ts", body: "x", line: 1, level: "NOTE", tags: [], unknownField: "unexpected" }],
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

  it.layer(claudeFakeLayer)((it) => {
    it.effect("指定されたeventがそのままAPIに渡される", () =>
      Effect.gen(function* () {
        for (const event of ["APPROVE", "COMMENT", "REQUEST_CHANGES"] as const) {
          const octokit = createMockOctokit();
          const input = { ...validInput, event };
          const submission = decodeReviewSubmission(JSON.stringify(input));
          yield* submitReview(octokit, submission);

          const call = vi.mocked(octokit.rest.pulls.createReview).mock.calls[0]?.[0];
          expect(call?.event).toBe(event);
        }
      }),
    );

    it.effect("headCommitIdがcommit_idとしてAPIに渡される", () =>
      Effect.gen(function* () {
        const octokit = createMockOctokit();
        const input = { ...validInput, headCommitId: "deadbeef1234567" };
        const submission = decodeReviewSubmission(JSON.stringify(input));
        yield* submitReview(octokit, submission);

        const call = vi.mocked(octokit.rest.pulls.createReview).mock.calls[0]?.[0];
        expect(call?.commit_id).toBe("deadbeef1234567");
      }),
    );

    it.effect("single lineコメントのパラメータが正しく変換される", () =>
      Effect.gen(function* () {
        const octokit = createMockOctokit();
        const input = {
          ...validInput,
          comments: [{ path: "src/foo.ts", body: "fix", line: 42, level: "IMPORTANT", tags: ["code-quality"] }],
        };
        const submission = decodeReviewSubmission(JSON.stringify(input));
        yield* submitReview(octokit, submission);

        const call = vi.mocked(octokit.rest.pulls.createReview).mock.calls[0]?.[0];
        const comment = call?.comments?.[0];
        expect(comment).toEqual({
          path: "src/foo.ts",
          body: "> [!IMPORTANT]\n> 🧹 Code Quality\n\nfix",
          line: 42,
          side: "RIGHT",
        });
      }),
    );

    it.effect("tagsが空配列ならタグラベルを出力しない", () =>
      Effect.gen(function* () {
        const octokit = createMockOctokit();
        const input = {
          ...validInput,
          comments: [{ path: "src/foo.ts", body: "fix", line: 42, level: "IMPORTANT", tags: [] }],
        };
        const submission = decodeReviewSubmission(JSON.stringify(input));
        yield* submitReview(octokit, submission);

        const call = vi.mocked(octokit.rest.pulls.createReview).mock.calls[0]?.[0];
        expect(call?.comments?.[0]?.body).toBe("> [!IMPORTANT]\n\nfix");
      }),
    );

    it.effect("複数tagをコメント本文に含められる", () =>
      Effect.gen(function* () {
        const octokit = createMockOctokit();
        const input = {
          ...validInput,
          comments: [
            { path: "src/foo.ts", body: "fix", line: 42, level: "IMPORTANT", tags: ["security", "performance"] },
          ],
        };
        const submission = decodeReviewSubmission(JSON.stringify(input));
        yield* submitReview(octokit, submission);

        const call = vi.mocked(octokit.rest.pulls.createReview).mock.calls[0]?.[0];
        expect(call?.comments?.[0]?.body).toBe("> [!IMPORTANT]\n> 🔒 Security ⚡ Performance\n\nfix");
      }),
    );

    it.effect("複数行コメントもGitHub Alert内に収まる", () =>
      Effect.gen(function* () {
        const octokit = createMockOctokit();
        const input = {
          ...validInput,
          comments: [{ path: "src/foo.ts", body: "line 1\n\nline 3", line: 42, level: "CAUTION", tags: ["security"] }],
        };
        const submission = decodeReviewSubmission(JSON.stringify(input));
        yield* submitReview(octokit, submission);

        const call = vi.mocked(octokit.rest.pulls.createReview).mock.calls[0]?.[0];
        expect(call?.comments?.[0]?.body).toBe("> [!CAUTION]\n> 🔒 Security\n\nline 1\n\nline 3");
      }),
    );

    it.effect("multi-lineコメントのパラメータが正しく変換される", () =>
      Effect.gen(function* () {
        const octokit = createMockOctokit();
        const input = {
          ...validInput,
          comments: [
            {
              path: "src/bar.ts",
              body: "refactor",
              line: 20,
              startLine: 10,
              side: "LEFT",
              level: "TIP",
              tags: ["test"],
            },
          ],
        };
        const submission = decodeReviewSubmission(JSON.stringify(input));
        yield* submitReview(octokit, submission);

        const call = vi.mocked(octokit.rest.pulls.createReview).mock.calls[0]?.[0];
        const comment = call?.comments?.[0];
        expect(comment).toEqual({
          path: "src/bar.ts",
          body: "> [!TIP]\n> 🧪 Test\n\nrefactor",
          line: 20,
          start_line: 10,
          side: "LEFT",
          start_side: "LEFT",
        });
      }),
    );

    it.effect("startLine指定でsideが未指定の場合はstart_sideもRIGHTになる", () =>
      Effect.gen(function* () {
        const octokit = createMockOctokit();
        const input = {
          ...validInput,
          comments: [{ path: "src/foo.ts", body: "x", line: 20, startLine: 10, level: "TIP", tags: ["test"] }],
        };
        const submission = decodeReviewSubmission(JSON.stringify(input));
        yield* submitReview(octokit, submission);
        const call = vi.mocked(octokit.rest.pulls.createReview).mock.calls[0]?.[0];
        expect(call?.comments?.[0]).toEqual({
          path: "src/foo.ts",
          body: "> [!TIP]\n> 🧪 Test\n\nx",
          line: 20,
          start_line: 10,
          side: "RIGHT",
          start_side: "RIGHT",
        });
      }),
    );

    it.effect("結果にreviewIdとhtmlUrlが含まれる", () =>
      Effect.gen(function* () {
        const octokit = createMockOctokit();
        const submission = decodeReviewSubmission(JSON.stringify(validInput));
        const submissionResult = yield* submitReview(octokit, submission);

        expect(submissionResult.reviewId).toBe(999);
        expect(submissionResult.htmlUrl).toEqual(
          new URL("https://github.com/test-owner/test-repo/pull/42#pullrequestreview-999"),
        );
      }),
    );
  });
});

describe("previewReview", () => {
  it.layer(claudeFakeLayer)((it) => {
    it.effect("createReviewが呼ばれない", () =>
      Effect.gen(function* () {
        const createReview = vi.fn();
        const octokit = { rest: { pulls: { createReview } } } as unknown as Octokit;
        const submission = decodeReviewSubmission(JSON.stringify(validInput));
        yield* previewReview(submission);

        expect(createReview).not.toHaveBeenCalled();
        // 念のため、Octokitの中身を全く触らないことを保証するため呼び出し回数で確認。
        expect(octokit.rest.pulls.createReview).not.toHaveBeenCalled();
      }),
    );

    it.effect("組み立て済みパラメータに必須フィールドが正しく入る", () =>
      Effect.gen(function* () {
        const submission = decodeReviewSubmission(
          JSON.stringify({ ...validInput, event: "REQUEST_CHANGES", headCommitId: "abc1234" }),
        );
        const params = yield* previewReview(submission);

        expect(params.owner).toBe("test-owner");
        expect(params.repo).toBe("test-repo");
        expect(params.pull_number).toBe(42);
        expect(params.commit_id).toBe("abc1234");
        expect(params.event).toBe("REQUEST_CHANGES");
        expect(params.body?.startsWith("review body")).toBe(true);
      }),
    );

    it.effect("bodyにメタデータフッターが付与されている", () =>
      Effect.gen(function* () {
        const submission = decodeReviewSubmission(JSON.stringify(validInput));
        const params = yield* previewReview(submission);

        expect(params.body ?? "").toContain("<details>");
      }),
    );

    it.effect("インラインコメントが`submitReview`と同じく変換される", () =>
      Effect.gen(function* () {
        const submission = decodeReviewSubmission(
          JSON.stringify({
            ...validInput,
            comments: [
              {
                path: "src/bar.ts",
                body: "refactor",
                line: 20,
                startLine: 10,
                side: "LEFT",
                level: "TIP",
                tags: ["test"],
              },
            ],
          }),
        );
        const params = yield* previewReview(submission);

        expect(params.comments).toEqual([
          {
            path: "src/bar.ts",
            body: "> [!TIP]\n> 🧪 Test\n\nrefactor",
            line: 20,
            start_line: 10,
            side: "LEFT",
            start_side: "LEFT",
          },
        ]);
      }),
    );

    it.effect("commentsを省略するとparamsのcommentsは空配列になる", () =>
      Effect.gen(function* () {
        const submission = decodeReviewSubmission(JSON.stringify(validInput));
        const params = yield* previewReview(submission);

        expect(params.comments).toEqual([]);
      }),
    );
  });
});
