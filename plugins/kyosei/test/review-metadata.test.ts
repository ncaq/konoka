import { it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { buildFooterView, buildReviewBody } from "../src/review-metadata";
import { decodeReviewSubmission } from "../src/submit-review";
import { fakeCommandExecutor } from "./fake-command";

// `claude --version`の呼び出しを失敗させ、`Option.none`にフォールバックさせます。
const claudeFakeLayer = fakeCommandExecutor(() => Effect.fail(new Error("claude not installed in test environment")));

const baseInput = {
  owner: "test-owner",
  repo: "test-repo",
  prNumber: 178,
  event: "COMMENT",
  body: "review body",
  headCommitId: "a214aef83b6ce8f",
};

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("KYOSEI_ACTION_VERSION", "");
  vi.stubEnv("GITHUB_ACTIONS", "");
  vi.stubEnv("GITHUB_SERVER_URL", "");
  vi.stubEnv("GITHUB_REPOSITORY", "");
  vi.stubEnv("GITHUB_RUN_ID", "");
  vi.stubEnv("CLAUDECODE", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("decodeReviewSubmission with metadata", () => {
  test("metadata.modelを受け入れる", () => {
    const submission = decodeReviewSubmission(JSON.stringify({ ...baseInput, metadata: { model: "claude-opus-4-7" } }));
    expect(submission.metadata?.model).toBe("claude-opus-4-7");
  });

  test("metadataを省略できる", () => {
    const submission = decodeReviewSubmission(JSON.stringify(baseInput));
    expect(submission.metadata).toBeUndefined();
  });

  test("metadata内の未知のプロパティはエラー", () => {
    expect(() =>
      decodeReviewSubmission(JSON.stringify({ ...baseInput, metadata: { model: "x", unknown: "y" } })),
    ).toThrow();
  });

  test("metadata.modelが空文字ならエラー", () => {
    expect(() => decodeReviewSubmission(JSON.stringify({ ...baseInput, metadata: { model: "" } }))).toThrow();
  });
});

describe("decodeReviewSubmission with internalErrors", () => {
  test("複数件の internalErrors を受け入れる", () => {
    const submission = decodeReviewSubmission(
      JSON.stringify({
        ...baseInput,
        internalErrors: [
          { subject: "first", body: "details 1" },
          { subject: "second", body: "details 2" },
        ],
      }),
    );
    expect(submission.internalErrors).toEqual([
      { subject: "first", body: "details 1" },
      { subject: "second", body: "details 2" },
    ]);
  });

  test("internalErrors の空配列も受け入れる", () => {
    const submission = decodeReviewSubmission(JSON.stringify({ ...baseInput, internalErrors: [] }));
    expect(submission.internalErrors).toEqual([]);
  });

  test("internalErrors を省略できる", () => {
    const submission = decodeReviewSubmission(JSON.stringify(baseInput));
    expect(submission.internalErrors).toBeUndefined();
  });

  test("subject が空文字ならエラー", () => {
    expect(() =>
      decodeReviewSubmission(JSON.stringify({ ...baseInput, internalErrors: [{ subject: "", body: "x" }] })),
    ).toThrow();
  });

  test("body が空文字ならエラー", () => {
    expect(() =>
      decodeReviewSubmission(JSON.stringify({ ...baseInput, internalErrors: [{ subject: "x", body: "" }] })),
    ).toThrow();
  });

  test("internalErrors 内の未知のプロパティはエラー", () => {
    expect(() =>
      decodeReviewSubmission(
        JSON.stringify({ ...baseInput, internalErrors: [{ subject: "x", body: "y", unknown: "z" }] }),
      ),
    ).toThrow();
  });
});

describe("buildFooterView", () => {
  it.layer(claudeFakeLayer)((it) => {
    it.effect("ローカル実行で必須項目が埋まる", () =>
      Effect.gen(function* () {
        vi.stubEnv("CLAUDECODE", "1");
        const submission = decodeReviewSubmission(
          JSON.stringify({ ...baseInput, metadata: { model: "claude-opus-4-7" } }),
        );

        const view = yield* buildFooterView(submission);

        expect(view.commit).toBe("a214aef83b6ce8f");
        expect(view.pr).toBe(178);
        expect(view.kyoseiVersion).toMatch(/^\d+\.\d+\.\d+/);
        expect(view.kyoseiActionVersion).toBe("unknown");
        expect(view.model).toBe("claude-opus-4-7");
        expect(view.execution).toBe("Claude Code CLI");
        expect(view.runUrl).toBeUndefined();
      }),
    );

    it.effect("GitHub Actions環境ではrunUrlが付く", () =>
      Effect.gen(function* () {
        vi.stubEnv("GITHUB_ACTIONS", "true");
        vi.stubEnv("GITHUB_SERVER_URL", "https://github.com");
        vi.stubEnv("GITHUB_REPOSITORY", "ncaq/konoka");
        vi.stubEnv("GITHUB_RUN_ID", "123");
        const submission = decodeReviewSubmission(JSON.stringify(baseInput));

        const view = yield* buildFooterView(submission);

        expect(view.execution).toBe("GitHub Actions");
        expect(view.runUrl).toEqual(new URL("https://github.com/ncaq/konoka/actions/runs/123"));
      }),
    );

    it.effect("KYOSEI_ACTION_VERSIONが渡されればそれを採用", () =>
      Effect.gen(function* () {
        vi.stubEnv("KYOSEI_ACTION_VERSION", "1.4.0");
        const submission = decodeReviewSubmission(JSON.stringify(baseInput));

        const view = yield* buildFooterView(submission);

        expect(view.kyoseiActionVersion).toBe("1.4.0");
      }),
    );

    it.effect("metadata.model未指定ならmodelはunknown", () =>
      Effect.gen(function* () {
        const submission = decodeReviewSubmission(JSON.stringify(baseInput));

        const view = yield* buildFooterView(submission);

        expect(view.model).toBe("unknown");
      }),
    );
  });
});

describe("buildReviewBody", () => {
  it.layer(claudeFakeLayer)((it) => {
    it.effect("本体にフッターが追記される", () =>
      Effect.gen(function* () {
        const submission = decodeReviewSubmission(
          JSON.stringify({ ...baseInput, metadata: { model: "claude-opus-4-7" } }),
        );

        const output = yield* buildReviewBody(submission);

        expect(output).toContain("review body");
        expect(output).toContain("<details>\n<summary>Review metadata</summary>");
        expect(output).toContain("- Reviewed commit: a214aef83b6ce8f");
        expect(output).toContain("- PR: #178");
        expect(output).toContain("- Model: claude-opus-4-7");
        expect(output).toContain("</details>");
      }),
    );

    it.effect("GitHub Actions環境ではrun URLリンクが含まれる", () =>
      Effect.gen(function* () {
        vi.stubEnv("GITHUB_ACTIONS", "true");
        vi.stubEnv("GITHUB_SERVER_URL", "https://github.com");
        vi.stubEnv("GITHUB_REPOSITORY", "ncaq/konoka");
        vi.stubEnv("GITHUB_RUN_ID", "123");
        const submission = decodeReviewSubmission(JSON.stringify(baseInput));

        const output = yield* buildReviewBody(submission);

        expect(output).toContain(
          "- Execution: GitHub Actions ([run](https://github.com/ncaq/konoka/actions/runs/123))",
        );
      }),
    );

    it.effect("ローカル実行ではrunリンクが付かない", () =>
      Effect.gen(function* () {
        vi.stubEnv("CLAUDECODE", "1");
        const submission = decodeReviewSubmission(JSON.stringify(baseInput));

        const output = yield* buildReviewBody(submission);

        expect(output).toContain("- Execution: Claude Code CLI\n");
        expect(output).not.toContain("[run]");
      }),
    );

    it.effect("internalErrors が複数件あれば見出しとbodyが順に出る", () =>
      Effect.gen(function* () {
        const submission = decodeReviewSubmission(
          JSON.stringify({
            ...baseInput,
            internalErrors: [
              { subject: "agent failed", body: "first error description" },
              { subject: "fetch timeout", body: "second error description" },
            ],
          }),
        );

        const output = yield* buildReviewBody(submission);

        expect(output).toContain("\n## Internal errors\n");
        // 見出しは1つだけ
        expect(output.match(/## Internal errors/g)?.length).toBe(1);
        expect(output).toContain("### agent failed\n\nfirst error description");
        expect(output).toContain("### fetch timeout\n\nsecond error description");
      }),
    );

    it.effect("body内のMarkdown(コードブロック含む)はそのまま展開される", () =>
      Effect.gen(function* () {
        const submission = decodeReviewSubmission(
          JSON.stringify({
            ...baseInput,
            internalErrors: [
              {
                subject: "agent crashed",
                body: "実行中に以下のエラーが発生しました。\n\n```\nError: foo\n  at bar\n```",
              },
            ],
          }),
        );

        const output = yield* buildReviewBody(submission);

        expect(output).toContain(
          "### agent crashed\n\n実行中に以下のエラーが発生しました。\n\n```\nError: foo\n  at bar\n```",
        );
      }),
    );

    it.effect("internalErrors 未指定なら Internal errors 見出しが出ない", () =>
      Effect.gen(function* () {
        const submission = decodeReviewSubmission(JSON.stringify(baseInput));

        const output = yield* buildReviewBody(submission);

        expect(output).not.toContain("Internal errors");
      }),
    );

    it.effect("internalErrors が空配列でも Internal errors 見出しが出ない", () =>
      Effect.gen(function* () {
        const submission = decodeReviewSubmission(JSON.stringify({ ...baseInput, internalErrors: [] }));

        const output = yield* buildReviewBody(submission);

        expect(output).not.toContain("Internal errors");
      }),
    );

    it.effect("Internal errors セクションは body の後・フッターの前に並ぶ", () =>
      Effect.gen(function* () {
        const submission = decodeReviewSubmission(
          JSON.stringify({
            ...baseInput,
            body: "review summary text",
            internalErrors: [{ subject: "agent failed", body: "Error" }],
          }),
        );

        const output = yield* buildReviewBody(submission);

        const bodyIndex = output.indexOf("review summary text");
        const errorsIndex = output.indexOf("## Internal errors");
        const footerIndex = output.indexOf("<details>");
        expect(bodyIndex).toBeGreaterThanOrEqual(0);
        expect(errorsIndex).toBeGreaterThan(bodyIndex);
        expect(footerIndex).toBeGreaterThan(errorsIndex);
      }),
    );
  });
});
