import type { Octokit } from "octokit";
import { describe, expect, test } from "vitest";
import { detectReviewContext } from "../src/context.js";

// URL解析テストではダミーで十分です。
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

  describe("ローカル出力モード(ブランチ解決失敗時)", () => {
    // サンドボックス環境はgitリポジトリではないのでブランチ解決が失敗してrejectされることを確認します。
    test("undefinedの場合はブランチ解決が試みられてrejectされる", async () => {
      await expect(detectReviewContext(dummyOctokit, undefined)).rejects.toThrow();
    });

    test("空文字の場合はブランチ解決が試みられてrejectされる", async () => {
      await expect(detectReviewContext(dummyOctokit, "")).rejects.toThrow();
    });

    test("空白のみの場合はブランチ解決が試みられてrejectされる", async () => {
      await expect(detectReviewContext(dummyOctokit, "   ")).rejects.toThrow();
    });

    test("URLではない文字列の場合はブランチ解決が試みられてrejectされる", async () => {
      await expect(detectReviewContext(dummyOctokit, "not-a-url")).rejects.toThrow();
    });

    test("PR URLではないGitHub URLの場合はブランチ解決が試みられてrejectされる", async () => {
      await expect(detectReviewContext(dummyOctokit, "https://github.com/ncaq/konoka")).rejects.toThrow();
    });

    test("issueのURLの場合はブランチ解決が試みられてrejectされる", async () => {
      await expect(detectReviewContext(dummyOctokit, "https://github.com/ncaq/konoka/issues/42")).rejects.toThrow();
    });

    test("PR番号が0の場合はブランチ解決が試みられてrejectされる", async () => {
      await expect(detectReviewContext(dummyOctokit, "https://github.com/ncaq/konoka/pull/0")).rejects.toThrow();
    });

    test("PR番号が負の場合はブランチ解決が試みられてrejectされる", async () => {
      await expect(detectReviewContext(dummyOctokit, "https://github.com/ncaq/konoka/pull/-1")).rejects.toThrow();
    });

    test("PR番号が数値でない場合はブランチ解決が試みられてrejectされる", async () => {
      await expect(detectReviewContext(dummyOctokit, "https://github.com/ncaq/konoka/pull/abc")).rejects.toThrow();
    });
  });
});
