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

describe("decodeReplySubmission", () => {
  test("正常なJSONをデコードできる", () => {
    expect(decodeReplySubmission(JSON.stringify(validSubmission))).toEqual(validSubmission);
  });

  test("summaryCommentを含むJSONをデコードできる", () => {
    const withSummary = { ...validSubmission, summaryComment: "全体の総括です。" };
    expect(decodeReplySubmission(JSON.stringify(withSummary))).toEqual(withSummary);
  });

  test("threadRepliesが空配列でもデコードできる", () => {
    const emptyReplies = { ...validSubmission, threadReplies: [] };
    expect(decodeReplySubmission(JSON.stringify(emptyReplies))).toEqual(emptyReplies);
  });

  test("JSONとして不正な文字列は例外になる", () => {
    expect(() => decodeReplySubmission("not-json")).toThrow();
  });

  test("threadIdが空文字の場合は例外になる", () => {
    const invalid = {
      ...validSubmission,
      threadReplies: [{ threadId: "", body: "body", resolve: false }],
    };
    expect(() => decodeReplySubmission(JSON.stringify(invalid))).toThrow();
  });

  test("bodyが空文字の場合は例外になる", () => {
    const invalid = {
      ...validSubmission,
      threadReplies: [{ threadId: "PRRT_1", body: "", resolve: false }],
    };
    expect(() => decodeReplySubmission(JSON.stringify(invalid))).toThrow();
  });

  test("resolveが欠けている場合は例外になる", () => {
    const invalid = {
      ...validSubmission,
      threadReplies: [{ threadId: "PRRT_1", body: "body" }],
    };
    expect(() => decodeReplySubmission(JSON.stringify(invalid))).toThrow();
  });

  test("prNumberが0の場合は例外になる", () => {
    const invalid = { ...validSubmission, prNumber: 0 };
    expect(() => decodeReplySubmission(JSON.stringify(invalid))).toThrow();
  });

  test("未知のプロパティがある場合は例外になる", () => {
    const invalid = { ...validSubmission, unknownField: "x" };
    expect(() => decodeReplySubmission(JSON.stringify(invalid))).toThrow();
  });
});
