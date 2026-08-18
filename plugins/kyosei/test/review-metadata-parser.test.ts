import { it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { decodeReviewSubmission } from "../src/review-decoder";
import { buildReviewBody } from "../src/review-metadata";
import { parseFooterMetadata } from "../src/review-metadata-parser";
import { FakeCommandError, fakeCommandExecutor } from "./fake-command";

const claudeFakeLayer = fakeCommandExecutor(() =>
  Effect.fail(new FakeCommandError({ message: "claude not installed in test environment" })),
);

const baseInput = {
  owner: "test-owner",
  repo: "test-repo",
  prNumber: 178,
  event: "COMMENT",
  body: "review summary",
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

describe("parseFooterMetadata", () => {
  it.layer(claudeFakeLayer)((it) => {
    it.effect("ローカル実行で生成したフッターを往復で復元できる", () =>
      Effect.gen(function* () {
        vi.stubEnv("CLAUDECODE", "1");
        const submission = decodeReviewSubmission(
          JSON.stringify({ ...baseInput, metadata: { model: "claude-opus-4-7" } }),
        );

        const body = yield* buildReviewBody(submission);
        const restored = parseFooterMetadata(body);

        expect(Option.isSome(restored)).toBe(true);
        if (Option.isSome(restored)) {
          expect(restored.value.commit).toBe("a214aef83b6ce8f");
          expect(restored.value.pr).toBe(178);
          expect(restored.value.model).toBe("claude-opus-4-7");
          expect(restored.value.execution).toBe("Claude Code CLI");
          expect(restored.value.runUrl).toBeUndefined();
        }
      }),
    );

    it.effect("GitHub Actions環境のrunUrl付きフッターを往復で復元できる", () =>
      Effect.gen(function* () {
        vi.stubEnv("GITHUB_ACTIONS", "true");
        vi.stubEnv("GITHUB_SERVER_URL", "https://github.com");
        vi.stubEnv("GITHUB_REPOSITORY", "ncaq/konoka");
        vi.stubEnv("GITHUB_RUN_ID", "123");
        const submission = decodeReviewSubmission(JSON.stringify(baseInput));

        const body = yield* buildReviewBody(submission);
        const restored = parseFooterMetadata(body);

        expect(Option.isSome(restored)).toBe(true);
        if (Option.isSome(restored)) {
          expect(restored.value.execution).toBe("GitHub Actions");
          expect(restored.value.runUrl).toEqual(
            new URL("https://github.com/ncaq/konoka/actions/runs/123"),
          );
        }
      }),
    );
  });

  it.layer(claudeFakeLayer)((it) => {
    it.effect("ownerやrepoに記号が含まれるフッターも往復で復元できる", () =>
      Effect.gen(function* () {
        vi.stubEnv("CLAUDECODE", "1");
        const submission = decodeReviewSubmission(
          JSON.stringify({ ...baseInput, owner: "test)owner", repo: "test]repo" }),
        );

        const body = yield* buildReviewBody(submission);
        const restored = parseFooterMetadata(body);

        expect(Option.isSome(restored)).toBe(true);
        if (Option.isSome(restored)) {
          expect(restored.value.commit).toBe("a214aef83b6ce8f");
          expect(restored.value.pr).toBe(178);
        }
      }),
    );
  });

  test("メタデータブロックが存在しない場合はNone", () => {
    expect(parseFooterMetadata("just a body without metadata")).toEqual(Option.none());
  });

  test("`<summary>`が異なるdetailsブロックは無視してNone", () => {
    const body = "<details>\n<summary>Other</summary>\n\n- Reviewed commit: abcdef1\n\n</details>";
    expect(parseFooterMetadata(body)).toEqual(Option.none());
  });

  test("Reviewed commitが欠落していればNone", () => {
    const body = [
      "<details>",
      "<summary>Review metadata</summary>",
      "",
      "- PR: #178",
      "- kyosei: 3.3.0",
      "- kyosei-action: unknown",
      "- Claude Code: unknown",
      "- Model: claude-opus-4-7",
      "- Execution: Claude Code CLI",
      "",
      "</details>",
    ].join("\n");
    expect(parseFooterMetadata(body)).toEqual(Option.none());
  });

  test("commitがSHA形式でなければNone", () => {
    const body = [
      "<details>",
      "<summary>Review metadata</summary>",
      "",
      "- Reviewed commit: not-a-sha",
      "- PR: #178",
      "- kyosei: 3.3.0",
      "- kyosei-action: unknown",
      "- Claude Code: unknown",
      "- Model: claude-opus-4-7",
      "- Execution: Claude Code CLI",
      "",
      "</details>",
    ].join("\n");
    expect(parseFooterMetadata(body)).toEqual(Option.none());
  });

  test("リンク付きのフッターから表示テキストの値を復元する", () => {
    const body = [
      "<details>",
      "<summary>Review metadata</summary>",
      "",
      "- Reviewed commit: [a214aef83b6ce8f](https://github.com/ncaq/konoka/commit/a214aef83b6ce8f)",
      "- PR: [#178](https://github.com/ncaq/konoka/pull/178)",
      "- kyosei: 3.3.0",
      "- kyosei-action: [2.4.0](https://github.com/ncaq/kyosei-action/releases/tag/v2.4.0)",
      "- Claude Code: [2.1.234](https://github.com/anthropics/claude-code/releases/tag/v2.1.234)",
      "- Model: claude-opus-4-7",
      "- Execution: Claude Code CLI",
      "",
      "</details>",
    ].join("\n");

    const restored = parseFooterMetadata(body);

    expect(Option.isSome(restored)).toBe(true);
    if (Option.isSome(restored)) {
      expect(restored.value.commit).toBe("a214aef83b6ce8f");
      expect(restored.value.pr).toBe(178);
      expect(restored.value.kyoseiActionVersion).toBe("2.4.0");
      expect(restored.value.claudeCodeVersion).toBe("2.1.234");
    }
  });

  test("リンク導入前に投稿された形式のフッターも復元できる", () => {
    const body = [
      "<details>",
      "<summary>Review metadata</summary>",
      "",
      "- Reviewed commit: a214aef83b6ce8f",
      "- PR: #178",
      "- kyosei: 3.3.0",
      "- kyosei-action: 2.4.0",
      "- Claude Code: 2.1.234",
      "- Model: claude-opus-4-7",
      "- Execution: Claude Code CLI",
      "",
      "</details>",
    ].join("\n");

    const restored = parseFooterMetadata(body);

    expect(Option.isSome(restored)).toBe(true);
    if (Option.isSome(restored)) {
      expect(restored.value.commit).toBe("a214aef83b6ce8f");
      expect(restored.value.pr).toBe(178);
      expect(restored.value.kyoseiActionVersion).toBe("2.4.0");
      expect(restored.value.claudeCodeVersion).toBe("2.1.234");
    }
  });

  test("PR番号が数値でなければNone", () => {
    const body = [
      "<details>",
      "<summary>Review metadata</summary>",
      "",
      "- Reviewed commit: a214aef83b6ce8f",
      "- PR: [#one-seven-eight](https://github.com/ncaq/konoka/pull/178)",
      "- kyosei: 3.3.0",
      "- kyosei-action: unknown",
      "- Claude Code: unknown",
      "- Model: claude-opus-4-7",
      "- Execution: Claude Code CLI",
      "",
      "</details>",
    ].join("\n");
    expect(parseFooterMetadata(body)).toEqual(Option.none());
  });

  test("kyoseiバージョンがSemVer形式でなければNone(将来のフォーマット変更時のフェイルセーフ)", () => {
    const body = [
      "<details>",
      "<summary>Review metadata</summary>",
      "",
      "- Reviewed commit: a214aef83b6ce8f",
      "- PR: #178",
      "- kyosei: not-semver",
      "- kyosei-action: unknown",
      "- Claude Code: unknown",
      "- Model: claude-opus-4-7",
      "- Execution: Claude Code CLI",
      "",
      "</details>",
    ].join("\n");
    expect(parseFooterMetadata(body)).toEqual(Option.none());
  });
});
