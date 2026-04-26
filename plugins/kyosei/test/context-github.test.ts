import { describe, expect, test } from "vitest";
import { parsePrUrl } from "../src/context-github";

describe("parsePrUrl", () => {
  test("標準的なPR URLからコンテキストを抽出する", () => {
    expect(parsePrUrl("https://github.com/ncaq/konoka/pull/42")).toEqual({
      output: "github",
      host: "github.com",
      pr: { owner: "ncaq", repo: "konoka", prNumber: 42 },
    });
  });

  test("末尾にサブパスがあっても抽出できる", () => {
    expect(parsePrUrl("https://github.com/ncaq/konoka/pull/42/files")).toEqual({
      output: "github",
      host: "github.com",
      pr: { owner: "ncaq", repo: "konoka", prNumber: 42 },
    });
  });

  test("クエリパラメータがあっても抽出できる", () => {
    expect(parsePrUrl("https://github.com/ncaq/konoka/pull/42?w=1")).toEqual({
      output: "github",
      host: "github.com",
      pr: { owner: "ncaq", repo: "konoka", prNumber: 42 },
    });
  });

  test("サブパスとクエリパラメータが両方あっても抽出できる", () => {
    expect(parsePrUrl("https://github.com/ncaq/konoka/pull/42/files?w=1")).toEqual({
      output: "github",
      host: "github.com",
      pr: { owner: "ncaq", repo: "konoka", prNumber: 42 },
    });
  });

  test("GitHub EnterpriseのドメインでもGitHub出力モードになる", () => {
    expect(parsePrUrl("https://ghe.example.com/org/repo/pull/7")).toEqual({
      output: "github",
      host: "ghe.example.com",
      pr: { owner: "org", repo: "repo", prNumber: 7 },
    });
  });

  test("末尾スラッシュがあっても抽出できる", () => {
    expect(parsePrUrl("https://github.com/owner/repo/pull/1/")).toEqual({
      output: "github",
      host: "github.com",
      pr: { owner: "owner", repo: "repo", prNumber: 1 },
    });
  });

  test("前後に空白があってもトリムされる", () => {
    expect(parsePrUrl("  https://github.com/ncaq/konoka/pull/42  ")).toEqual({
      output: "github",
      host: "github.com",
      pr: { owner: "ncaq", repo: "konoka", prNumber: 42 },
    });
  });

  test("URLではない文字列の場合はundefinedを返す", () => {
    expect(parsePrUrl("not-a-url")).toBeUndefined();
  });

  test("PR URLではないGitHub URLの場合はundefinedを返す", () => {
    expect(parsePrUrl("https://github.com/ncaq/konoka")).toBeUndefined();
  });

  test("issueのURLの場合はundefinedを返す", () => {
    expect(parsePrUrl("https://github.com/ncaq/konoka/issues/42")).toBeUndefined();
  });

  test("PR番号が0の場合はundefinedを返す", () => {
    expect(parsePrUrl("https://github.com/ncaq/konoka/pull/0")).toBeUndefined();
  });

  test("PR番号が負の場合はundefinedを返す", () => {
    expect(parsePrUrl("https://github.com/ncaq/konoka/pull/-1")).toBeUndefined();
  });

  test("PR番号が数値でない場合はundefinedを返す", () => {
    expect(parsePrUrl("https://github.com/ncaq/konoka/pull/abc")).toBeUndefined();
  });
});
