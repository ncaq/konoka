import type { Octokit } from "octokit";
import { describe, expect, test } from "vitest";
import { detectReviewContext } from "../src/context.js";

// URL解析テストではOctokitは使われないためダミーで十分です。
// ローカルモードテストではgitコマンド実行がcatchされてpr無しになります。
const dummyOctokit = {} as Octokit;

describe("detectReviewContext", () => {
  describe("GitHub出力モード", () => {
    test("標準的なPR URLからコンテキストを抽出する", async () => {
      expect(await detectReviewContext(dummyOctokit, "https://github.com/ncaq/konoka/pull/42")).toEqual({
        output: "github",
        host: "github.com",
        pr: { owner: "ncaq", repo: "konoka", prNumber: 42 },
      });
    });

    test("末尾にサブパスがあっても抽出できる", async () => {
      expect(await detectReviewContext(dummyOctokit, "https://github.com/ncaq/konoka/pull/42/files")).toEqual({
        output: "github",
        host: "github.com",
        pr: { owner: "ncaq", repo: "konoka", prNumber: 42 },
      });
    });

    test("クエリパラメータがあっても抽出できる", async () => {
      expect(await detectReviewContext(dummyOctokit, "https://github.com/ncaq/konoka/pull/42?w=1")).toEqual({
        output: "github",
        host: "github.com",
        pr: { owner: "ncaq", repo: "konoka", prNumber: 42 },
      });
    });

    test("サブパスとクエリパラメータが両方あっても抽出できる", async () => {
      expect(await detectReviewContext(dummyOctokit, "https://github.com/ncaq/konoka/pull/42/files?w=1")).toEqual({
        output: "github",
        host: "github.com",
        pr: { owner: "ncaq", repo: "konoka", prNumber: 42 },
      });
    });

    test("GitHub EnterpriseのドメインでもGitHub出力モードになる", async () => {
      expect(await detectReviewContext(dummyOctokit, "https://ghe.example.com/org/repo/pull/7")).toEqual({
        output: "github",
        host: "ghe.example.com",
        pr: { owner: "org", repo: "repo", prNumber: 7 },
      });
    });

    test("末尾スラッシュがあっても抽出できる", async () => {
      expect(await detectReviewContext(dummyOctokit, "https://github.com/owner/repo/pull/1/")).toEqual({
        output: "github",
        host: "github.com",
        pr: { owner: "owner", repo: "repo", prNumber: 1 },
      });
    });

    test("前後に空白があってもトリムされる", async () => {
      expect(await detectReviewContext(dummyOctokit, "  https://github.com/ncaq/konoka/pull/42  ")).toEqual({
        output: "github",
        host: "github.com",
        pr: { owner: "ncaq", repo: "konoka", prNumber: 42 },
      });
    });
  });

  describe("ローカル出力モード", () => {
    test("undefinedの場合はローカルモード", async () => {
      const context = await detectReviewContext(dummyOctokit, undefined);
      expect(context.output).toBe("local");
    });

    test("空文字の場合はローカルモード", async () => {
      const context = await detectReviewContext(dummyOctokit, "");
      expect(context.output).toBe("local");
    });

    test("空白のみの場合はローカルモード", async () => {
      const context = await detectReviewContext(dummyOctokit, "   ");
      expect(context.output).toBe("local");
    });

    test("URLではない文字列の場合はローカルモード", async () => {
      const context = await detectReviewContext(dummyOctokit, "not-a-url");
      expect(context.output).toBe("local");
    });

    test("PR URLではないGitHub URLの場合はローカルモード", async () => {
      const context = await detectReviewContext(dummyOctokit, "https://github.com/ncaq/konoka");
      expect(context.output).toBe("local");
    });

    test("issueのURLの場合はローカルモード", async () => {
      const context = await detectReviewContext(dummyOctokit, "https://github.com/ncaq/konoka/issues/42");
      expect(context.output).toBe("local");
    });

    test("PR番号が0の場合はローカルモード", async () => {
      const context = await detectReviewContext(dummyOctokit, "https://github.com/ncaq/konoka/pull/0");
      expect(context.output).toBe("local");
    });

    test("PR番号が負の場合はローカルモード", async () => {
      const context = await detectReviewContext(dummyOctokit, "https://github.com/ncaq/konoka/pull/-1");
      expect(context.output).toBe("local");
    });

    test("PR番号が数値でない場合はローカルモード", async () => {
      const context = await detectReviewContext(dummyOctokit, "https://github.com/ncaq/konoka/pull/abc");
      expect(context.output).toBe("local");
    });
  });
});
