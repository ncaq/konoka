import { DateTime, Option } from "effect";
import { describe, expect, test } from "vitest";
import type { Conversation, ConversationReview } from "../src/conversation";
import { pickPreviousKyoseiReview } from "../src/previous-review";

function buildFooter(commit: string, version = "3.3.0"): string {
  return [
    "<details>",
    "<summary>Review metadata</summary>",
    "",
    `- Reviewed commit: ${commit}`,
    "- PR: #178",
    `- kyosei: ${version}`,
    "- kyosei-action: unknown",
    "- Claude Code: unknown",
    "- Model: claude-opus-4-7",
    "- Execution: Claude Code CLI",
    "",
    "</details>",
  ].join("\n");
}

function makeReview(overrides: Partial<ConversationReview>): ConversationReview {
  return {
    id: "R1",
    author: "kyosei-bot",
    state: "COMMENTED",
    body: "summary text",
    submittedAt: "2026-04-01T00:00:00Z",
    url: "https://github.com/test/repo/pull/1#pullrequestreview-1",
    ...overrides,
  };
}

function makeConversation(reviews: ConversationReview[]): Conversation {
  return {
    title: "PR title",
    body: "PR body",
    author: "author",
    url: "https://github.com/test/repo/pull/1",
    comments: [],
    reviews,
    reviewThreads: [],
  };
}

describe("pickPreviousKyoseiReview", () => {
  test("メタデータ付きレビューが1件あれば抽出できる", () => {
    const conversation = makeConversation([
      makeReview({
        id: "R1",
        state: "APPROVED",
        body: `LGTM\n\n${buildFooter("a214aef83b6ce8f")}`,
        submittedAt: "2026-04-01T00:00:00Z",
      }),
    ]);

    const result = pickPreviousKyoseiReview(conversation);

    expect(Option.isSome(result)).toBe(true);
    if (Option.isSome(result)) {
      expect(result.value.reviewId).toBe("R1");
      expect(result.value.metadata.commit).toBe("a214aef83b6ce8f");
      expect(result.value.event).toBe("APPROVED");
      expect(result.value.metadata.pr).toBe(178);
      expect(DateTime.toDateUtc(result.value.submittedAt).toISOString()).toBe(
        "2026-04-01T00:00:00.000Z",
      );
    }
  });

  test("submittedAtが新しい順で最新が選ばれる(逆順入力でも)", () => {
    const conversation = makeConversation([
      makeReview({
        id: "older",
        body: `prev\n\n${buildFooter("aaaaaaa")}`,
        submittedAt: "2026-04-01T00:00:00Z",
      }),
      makeReview({
        id: "newer",
        body: `latest\n\n${buildFooter("bbbbbbb")}`,
        submittedAt: "2026-04-15T00:00:00Z",
      }),
      makeReview({
        id: "middle",
        body: `middle\n\n${buildFooter("ccccccc")}`,
        submittedAt: "2026-04-10T00:00:00Z",
      }),
    ]);

    const result = pickPreviousKyoseiReview(conversation);

    expect(Option.isSome(result)).toBe(true);
    if (Option.isSome(result)) {
      expect(result.value.reviewId).toBe("newer");
      expect(result.value.metadata.commit).toBe("bbbbbbb");
    }
  });

  test("メタデータ無しレビューはスキップ", () => {
    const conversation = makeConversation([
      makeReview({ id: "no-metadata", body: "LGTM", submittedAt: "2026-04-15T00:00:00Z" }),
      makeReview({
        id: "with-metadata",
        body: `summary\n\n${buildFooter("a214aef83b6ce8f")}`,
        submittedAt: "2026-04-01T00:00:00Z",
      }),
    ]);

    const result = pickPreviousKyoseiReview(conversation);

    expect(Option.isSome(result)).toBe(true);
    if (Option.isSome(result)) {
      expect(result.value.reviewId).toBe("with-metadata");
    }
  });

  test("submittedAtがnullのレビューはスキップ", () => {
    const conversation = makeConversation([
      makeReview({
        id: "no-submitted-at",
        body: `summary\n\n${buildFooter("aaaaaaa")}`,
        submittedAt: null,
      }),
      makeReview({
        id: "valid",
        body: `summary\n\n${buildFooter("bbbbbbb")}`,
        submittedAt: "2026-04-10T00:00:00Z",
      }),
    ]);

    const result = pickPreviousKyoseiReview(conversation);

    expect(Option.isSome(result)).toBe(true);
    if (Option.isSome(result)) {
      expect(result.value.reviewId).toBe("valid");
    }
  });

  test("候補が無ければNone", () => {
    const conversation = makeConversation([makeReview({ body: "no metadata at all" })]);
    expect(pickPreviousKyoseiReview(conversation)).toEqual(Option.none());
  });

  test("kyoseiバージョンがSemVer形式でないレビューは除外される", () => {
    const conversation = makeConversation([
      makeReview({
        id: "broken",
        body: `summary\n\n${buildFooter("aaaaaaa", "not-semver")}`,
        submittedAt: "2026-04-15T00:00:00Z",
      }),
      makeReview({
        id: "valid",
        body: `summary\n\n${buildFooter("bbbbbbb")}`,
        submittedAt: "2026-04-10T00:00:00Z",
      }),
    ]);

    const result = pickPreviousKyoseiReview(conversation);

    expect(Option.isSome(result)).toBe(true);
    if (Option.isSome(result)) {
      expect(result.value.reviewId).toBe("valid");
    }
  });
});
