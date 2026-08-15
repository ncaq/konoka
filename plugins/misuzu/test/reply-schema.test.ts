import { Effect } from "effect";
import { describe, expect, test } from "vitest";
import { decodeReplySubmission } from "../src/reply-schema";

const validSubmission = {
  owner: "ncaq",
  repo: "konoka",
  prNumber: 42,
  threadReplies: [
    {
      threadId: "PRRT_kwDOExample",
      body: "commit abc1234 で修正しました。",
      resolve: true,
    },
  ],
};

// デコードは同期的なEffectなので`runSync`で十分です。
// 失敗はFiberFailureのthrowとして観測します。
function decode(input: string): unknown {
  return Effect.runSync(decodeReplySubmission(input));
}

describe("decodeReplySubmission", () => {
  test("正常なJSONをデコードできる", () => {
    expect(decode(JSON.stringify(validSubmission))).toEqual(validSubmission);
  });

  test("summaryCommentを含むJSONをデコードできる", () => {
    const withSummary = { ...validSubmission, summaryComment: "全体の総括です。" };
    expect(decode(JSON.stringify(withSummary))).toEqual(withSummary);
  });

  test("threadRepliesが空配列でもデコードできる", () => {
    const emptyReplies = { ...validSubmission, threadReplies: [] };
    expect(decode(JSON.stringify(emptyReplies))).toEqual(emptyReplies);
  });

  test("JSONとして不正な文字列は失敗する", () => {
    expect(() => decode("not-json")).toThrow();
  });

  test("threadIdが空文字の場合は失敗する", () => {
    const invalid = {
      ...validSubmission,
      threadReplies: [{ threadId: "", body: "body", resolve: false }],
    };
    expect(() => decode(JSON.stringify(invalid))).toThrow();
  });

  test("bodyが空文字の場合は失敗する", () => {
    const invalid = {
      ...validSubmission,
      threadReplies: [{ threadId: "PRRT_1", body: "", resolve: false }],
    };
    expect(() => decode(JSON.stringify(invalid))).toThrow();
  });

  test("resolveが欠けている場合は失敗する", () => {
    const invalid = {
      ...validSubmission,
      threadReplies: [{ threadId: "PRRT_1", body: "body" }],
    };
    expect(() => decode(JSON.stringify(invalid))).toThrow();
  });

  test("prNumberが0の場合は失敗する", () => {
    const invalid = { ...validSubmission, prNumber: 0 };
    expect(() => decode(JSON.stringify(invalid))).toThrow();
  });

  test("未知のプロパティがある場合は失敗する", () => {
    const invalid = { ...validSubmission, unknownField: "x" };
    expect(() => decode(JSON.stringify(invalid))).toThrow();
  });
});
