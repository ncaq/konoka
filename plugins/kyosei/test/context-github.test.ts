import { Either } from "effect";
import { describe, expect, test } from "vitest";
import { parsePrUrl } from "../src/context-github";

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
});
