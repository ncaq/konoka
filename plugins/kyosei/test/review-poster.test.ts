import { it } from "@effect/vitest";
import { Effect } from "effect";
import type { Octokit } from "octokit";
import { describe, expect, vi } from "vitest";
import { decodeReviewSubmission } from "../src/review-decoder";
import { previewReview, submitReview } from "../src/review-poster";
import { fakeCommandExecutor } from "./fake-command";

const claudeFakeLayer = fakeCommandExecutor(() =>
  Effect.fail(new Error("claude not installed in test environment")),
);

/** テスト用の最小限の有効な入力。 */
const validInput = {
  owner: "test-owner",
  repo: "test-repo",
  prNumber: 42,
  event: "APPROVE",
  body: "review body",
  headCommitId: "0123456789abcdef0123456789abcdef01234567",
};

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
          comments: [
            {
              path: "src/foo.ts",
              body: "fix",
              line: 42,
              level: "IMPORTANT",
              tags: ["code-quality"],
            },
          ],
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
            {
              path: "src/foo.ts",
              body: "fix",
              line: 42,
              level: "IMPORTANT",
              tags: ["security", "performance"],
            },
          ],
        };
        const submission = decodeReviewSubmission(JSON.stringify(input));
        yield* submitReview(octokit, submission);

        const call = vi.mocked(octokit.rest.pulls.createReview).mock.calls[0]?.[0];
        expect(call?.comments?.[0]?.body).toBe(
          "> [!IMPORTANT]\n> 🔒 Security ⚡ Performance\n\nfix",
        );
      }),
    );

    it.effect("複数行コメントもGitHub Alert内に収まる", () =>
      Effect.gen(function* () {
        const octokit = createMockOctokit();
        const input = {
          ...validInput,
          comments: [
            {
              path: "src/foo.ts",
              body: "line 1\n\nline 3",
              line: 42,
              level: "CAUTION",
              tags: ["security"],
            },
          ],
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
          comments: [
            {
              path: "src/foo.ts",
              body: "x",
              line: 20,
              startLine: 10,
              level: "TIP",
              tags: ["test"],
            },
          ],
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
