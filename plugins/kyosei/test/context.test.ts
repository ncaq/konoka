import { describe, expect, test } from "vitest";
import { detectReviewContext } from "../src/context.js";

describe("detectReviewContext", () => {
  describe("PRレビューモード", () => {
    test("標準的なPR URLからコンテキストを抽出する", () => {
      expect(detectReviewContext("https://github.com/ncaq/konoka/pull/42")).toEqual({
        mode: "pr",
        host: "github.com",
        owner: "ncaq",
        repo: "konoka",
        prNumber: 42,
      });
    });

    test("末尾にサブパスがあっても抽出できる", () => {
      expect(detectReviewContext("https://github.com/ncaq/konoka/pull/42/files")).toEqual({
        mode: "pr",
        host: "github.com",
        owner: "ncaq",
        repo: "konoka",
        prNumber: 42,
      });
    });

    test("クエリパラメータがあっても抽出できる", () => {
      expect(detectReviewContext("https://github.com/ncaq/konoka/pull/42?w=1")).toEqual({
        mode: "pr",
        host: "github.com",
        owner: "ncaq",
        repo: "konoka",
        prNumber: 42,
      });
    });

    test("サブパスとクエリパラメータが両方あっても抽出できる", () => {
      expect(detectReviewContext("https://github.com/ncaq/konoka/pull/42/files?w=1")).toEqual({
        mode: "pr",
        host: "github.com",
        owner: "ncaq",
        repo: "konoka",
        prNumber: 42,
      });
    });

    test("GitHub EnterpriseのドメインでもPRモードになる", () => {
      expect(detectReviewContext("https://ghe.example.com/org/repo/pull/7")).toEqual({
        mode: "pr",
        host: "ghe.example.com",
        owner: "org",
        repo: "repo",
        prNumber: 7,
      });
    });

    test("末尾スラッシュがあっても抽出できる", () => {
      expect(detectReviewContext("https://github.com/owner/repo/pull/1/")).toEqual({
        mode: "pr",
        host: "github.com",
        owner: "owner",
        repo: "repo",
        prNumber: 1,
      });
    });

    test("前後に空白があってもトリムされる", () => {
      expect(detectReviewContext("  https://github.com/ncaq/konoka/pull/42  ")).toEqual({
        mode: "pr",
        host: "github.com",
        owner: "ncaq",
        repo: "konoka",
        prNumber: 42,
      });
    });
  });

  describe("ローカルレビューモード", () => {
    test("undefinedの場合はローカルモード", () => {
      expect(detectReviewContext(undefined)).toEqual({ mode: "local" });
    });

    test("空文字の場合はローカルモード", () => {
      expect(detectReviewContext("")).toEqual({ mode: "local" });
    });

    test("空白のみの場合はローカルモード", () => {
      expect(detectReviewContext("   ")).toEqual({ mode: "local" });
    });

    test("URLではない文字列の場合はローカルモード", () => {
      expect(detectReviewContext("not-a-url")).toEqual({ mode: "local" });
    });

    test("PR URLではないGitHub URLの場合はローカルモード", () => {
      expect(detectReviewContext("https://github.com/ncaq/konoka")).toEqual({ mode: "local" });
    });

    test("issueのURLの場合はローカルモード", () => {
      expect(detectReviewContext("https://github.com/ncaq/konoka/issues/42")).toEqual({ mode: "local" });
    });

    test("PR番号が0の場合はローカルモード", () => {
      expect(detectReviewContext("https://github.com/ncaq/konoka/pull/0")).toEqual({ mode: "local" });
    });

    test("PR番号が負の場合はローカルモード", () => {
      expect(detectReviewContext("https://github.com/ncaq/konoka/pull/-1")).toEqual({ mode: "local" });
    });

    test("PR番号が数値でない場合はローカルモード", () => {
      expect(detectReviewContext("https://github.com/ncaq/konoka/pull/abc")).toEqual({ mode: "local" });
    });
  });
});
