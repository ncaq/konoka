import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { buildFooterView, mkBodyAppendMetadata } from "../src/review-metadata";
import { decodeReviewSubmission } from "../src/submit-review";

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

describe("buildFooterView", () => {
  test("ローカル実行で必須項目が埋まる", async () => {
    vi.stubEnv("CLAUDECODE", "1");
    const submission = decodeReviewSubmission(JSON.stringify({ ...baseInput, metadata: { model: "claude-opus-4-7" } }));

    const view = await buildFooterView(submission);

    expect(view.commit).toBe("a214aef83b6ce8f");
    expect(view.pr).toBe(178);
    expect(view.kyoseiVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(view.kyoseiActionVersion).toBe("unknown");
    expect(view.model).toBe("claude-opus-4-7");
    expect(view.execution).toBe("Claude Code CLI");
    expect(view.runUrl).toBeUndefined();
  });

  test("GitHub Actions環境ではrunUrlが付く", async () => {
    vi.stubEnv("GITHUB_ACTIONS", "true");
    vi.stubEnv("GITHUB_SERVER_URL", "https://github.com");
    vi.stubEnv("GITHUB_REPOSITORY", "ncaq/konoka");
    vi.stubEnv("GITHUB_RUN_ID", "123");
    const submission = decodeReviewSubmission(JSON.stringify(baseInput));

    const view = await buildFooterView(submission);

    expect(view.execution).toBe("GitHub Actions");
    expect(view.runUrl).toEqual(new URL("https://github.com/ncaq/konoka/actions/runs/123"));
  });

  test("KYOSEI_ACTION_VERSIONが渡されればそれを採用", async () => {
    vi.stubEnv("KYOSEI_ACTION_VERSION", "1.4.0");
    const submission = decodeReviewSubmission(JSON.stringify(baseInput));

    const view = await buildFooterView(submission);

    expect(view.kyoseiActionVersion).toBe("1.4.0");
  });

  test("metadata.model未指定ならmodelはunknown", async () => {
    const submission = decodeReviewSubmission(JSON.stringify(baseInput));

    const view = await buildFooterView(submission);

    expect(view.model).toBe("unknown");
  });
});

describe("appendMetadataFooter", () => {
  test("本体にフッターが追記される", async () => {
    const submission = decodeReviewSubmission(JSON.stringify({ ...baseInput, metadata: { model: "claude-opus-4-7" } }));

    const output = await mkBodyAppendMetadata(submission);

    expect(output).toContain("review body");
    expect(output).toContain("<details>\n<summary>Review metadata</summary>");
    expect(output).toContain("- Reviewed commit: a214aef83b6ce8f");
    expect(output).toContain("- PR: #178");
    expect(output).toContain("- Model: claude-opus-4-7");
    expect(output).toContain("</details>");
  });

  test("GitHub Actions環境ではrun URLリンクが含まれる", async () => {
    vi.stubEnv("GITHUB_ACTIONS", "true");
    vi.stubEnv("GITHUB_SERVER_URL", "https://github.com");
    vi.stubEnv("GITHUB_REPOSITORY", "ncaq/konoka");
    vi.stubEnv("GITHUB_RUN_ID", "123");
    const submission = decodeReviewSubmission(JSON.stringify(baseInput));

    const output = await mkBodyAppendMetadata(submission);

    expect(output).toContain("- Execution: GitHub Actions ([run](https://github.com/ncaq/konoka/actions/runs/123))");
  });

  test("ローカル実行ではrunリンクが付かない", async () => {
    vi.stubEnv("CLAUDECODE", "1");
    const submission = decodeReviewSubmission(JSON.stringify(baseInput));

    const output = await mkBodyAppendMetadata(submission);

    expect(output).toContain("- Execution: Claude Code CLI\n");
    expect(output).not.toContain("[run]");
  });
});
