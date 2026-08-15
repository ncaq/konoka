import { Either } from "effect";
import { describe, expect, test } from "vitest";
import { parseFocusFragment, parsePrUrl } from "../src/context-github";

describe("parsePrUrl", () => {
  test("標準的なPR URLからコンテキストを抽出する", () => {
    expect(parsePrUrl("https://github.com/ncaq/konoka/pull/42")).toEqual(
      Either.right({
        output: "github",
        host: "github.com",
        pr: { owner: "ncaq", repo: "konoka", prNumber: 42 },
      }),
    );
  });

  test("末尾にサブパスがあっても抽出できる", () => {
    expect(parsePrUrl("https://github.com/ncaq/konoka/pull/42/files")).toEqual(
      Either.right({
        output: "github",
        host: "github.com",
        pr: { owner: "ncaq", repo: "konoka", prNumber: 42 },
      }),
    );
  });

  test("クエリパラメータがあっても抽出できる", () => {
    expect(parsePrUrl("https://github.com/ncaq/konoka/pull/42?w=1")).toEqual(
      Either.right({
        output: "github",
        host: "github.com",
        pr: { owner: "ncaq", repo: "konoka", prNumber: 42 },
      }),
    );
  });

  test("サブパスとクエリパラメータが両方あっても抽出できる", () => {
    expect(parsePrUrl("https://github.com/ncaq/konoka/pull/42/files?w=1")).toEqual(
      Either.right({
        output: "github",
        host: "github.com",
        pr: { owner: "ncaq", repo: "konoka", prNumber: 42 },
      }),
    );
  });

  test("GitHub EnterpriseのドメインでもGitHub出力モードになる", () => {
    expect(parsePrUrl("https://ghe.example.com/org/repo/pull/7")).toEqual(
      Either.right({
        output: "github",
        host: "ghe.example.com",
        pr: { owner: "org", repo: "repo", prNumber: 7 },
      }),
    );
  });

  test("末尾スラッシュがあっても抽出できる", () => {
    expect(parsePrUrl("https://github.com/owner/repo/pull/1/")).toEqual(
      Either.right({
        output: "github",
        host: "github.com",
        pr: { owner: "owner", repo: "repo", prNumber: 1 },
      }),
    );
  });

  test("前後に空白があってもトリムされる", () => {
    expect(parsePrUrl("  https://github.com/ncaq/konoka/pull/42  ")).toEqual(
      Either.right({
        output: "github",
        host: "github.com",
        pr: { owner: "ncaq", repo: "konoka", prNumber: 42 },
      }),
    );
  });

  test("URLではない文字列の場合はLeftを返す", () => {
    expect(Either.isLeft(parsePrUrl("not-a-url"))).toBe(true);
  });

  test("PR URLではないGitHub URLの場合はLeftを返す", () => {
    expect(Either.isLeft(parsePrUrl("https://github.com/ncaq/konoka"))).toBe(true);
  });

  test("issueのURLの場合はLeftを返す", () => {
    expect(Either.isLeft(parsePrUrl("https://github.com/ncaq/konoka/issues/42"))).toBe(true);
  });

  test("PR番号が0の場合はLeftを返す", () => {
    expect(Either.isLeft(parsePrUrl("https://github.com/ncaq/konoka/pull/0"))).toBe(true);
  });

  test("PR番号が負の場合はLeftを返す", () => {
    expect(Either.isLeft(parsePrUrl("https://github.com/ncaq/konoka/pull/-1"))).toBe(true);
  });

  test("PR番号が数値でない場合はLeftを返す", () => {
    expect(Either.isLeft(parsePrUrl("https://github.com/ncaq/konoka/pull/abc"))).toBe(true);
  });

  test("レビューURLのフラグメントからfocusを抽出する", () => {
    expect(
      parsePrUrl("https://github.com/ncaq/konoka/pull/42#pullrequestreview-123456789"),
    ).toEqual(
      Either.right({
        output: "github",
        host: "github.com",
        pr: { owner: "ncaq", repo: "konoka", prNumber: 42 },
        focus: { kind: "review", databaseId: 123456789 },
      }),
    );
  });

  test("レビューコメントURLのフラグメントからfocusを抽出する", () => {
    expect(parsePrUrl("https://github.com/ncaq/konoka/pull/42#discussion_r987654321")).toEqual(
      Either.right({
        output: "github",
        host: "github.com",
        pr: { owner: "ncaq", repo: "konoka", prNumber: 42 },
        focus: { kind: "review-comment", databaseId: 987654321 },
      }),
    );
  });

  test("Files changedタブのコメントURLのフラグメントからfocusを抽出する", () => {
    expect(parsePrUrl("https://github.com/ncaq/konoka/pull/42/files#r987654321")).toEqual(
      Either.right({
        output: "github",
        host: "github.com",
        pr: { owner: "ncaq", repo: "konoka", prNumber: 42 },
        focus: { kind: "review-comment", databaseId: 987654321 },
      }),
    );
  });

  test("PRコメントURLのフラグメントからfocusを抽出する", () => {
    expect(parsePrUrl("https://github.com/ncaq/konoka/pull/42#issuecomment-11223344")).toEqual(
      Either.right({
        output: "github",
        host: "github.com",
        pr: { owner: "ncaq", repo: "konoka", prNumber: 42 },
        focus: { kind: "issue-comment", databaseId: 11223344 },
      }),
    );
  });

  test("未知のフラグメントはfocusなしとして扱う", () => {
    expect(parsePrUrl("https://github.com/ncaq/konoka/pull/42#partial-timeline")).toEqual(
      Either.right({
        output: "github",
        host: "github.com",
        pr: { owner: "ncaq", repo: "konoka", prNumber: 42 },
      }),
    );
  });
});

describe("parseFocusFragment", () => {
  test("フラグメント文字列を直接解釈できる", () => {
    expect(parseFocusFragment("#pullrequestreview-1")).toEqual({
      kind: "review",
      databaseId: 1,
    });
  });

  test("空文字はundefinedを返す", () => {
    expect(parseFocusFragment("")).toBeUndefined();
  });

  test("IDが数値でない場合はundefinedを返す", () => {
    expect(parseFocusFragment("#discussion_rabc")).toBeUndefined();
  });

  test("IDが0の場合はundefinedを返す", () => {
    expect(parseFocusFragment("#issuecomment-0")).toBeUndefined();
  });

  test("rで始まるだけの未知の形式をreview-commentと誤認しない", () => {
    // 接頭辞の部分一致だとr123の後に余計な文字列が続く形式を拾ってしまう。
    expect(parseFocusFragment("#r123-extra")).toBeUndefined();
    expect(parseFocusFragment("#readme")).toBeUndefined();
  });
});
