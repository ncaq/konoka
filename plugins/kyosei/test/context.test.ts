import type { Octokit } from "octokit";
import { describe, expect, test } from "vitest";
import { detectReviewContext } from "../src/context";

const dummyOctokit = {} as Octokit;

describe("detectReviewContext", () => {
  // サンドボックス環境はgitリポジトリではないため、
  // ローカル出力パスに進んだ場合はresolveLocalContextがrejectします。
  // これによりPR URLでない引数がローカル解決にフォールスルーすることを確認できます。

  test("undefinedの場合はローカル解決にフォールスルーする", async () => {
    await expect(detectReviewContext(dummyOctokit, undefined)).rejects.toThrow();
  });

  test("空文字の場合はローカル解決にフォールスルーする", async () => {
    await expect(detectReviewContext(dummyOctokit, "")).rejects.toThrow();
  });

  test("空白のみの場合はローカル解決にフォールスルーする", async () => {
    await expect(detectReviewContext(dummyOctokit, "   ")).rejects.toThrow();
  });

  test("URLではない文字列の場合はローカル解決にフォールスルーする", async () => {
    await expect(detectReviewContext(dummyOctokit, "not-a-url")).rejects.toThrow();
  });

  test("PR URLではないGitHub URLの場合はローカル解決にフォールスルーする", async () => {
    await expect(detectReviewContext(dummyOctokit, "https://github.com/ncaq/konoka")).rejects.toThrow();
  });

  test("issueのURLの場合はローカル解決にフォールスルーする", async () => {
    await expect(detectReviewContext(dummyOctokit, "https://github.com/ncaq/konoka/issues/42")).rejects.toThrow();
  });

  test("PR番号が0の場合はローカル解決にフォールスルーする", async () => {
    await expect(detectReviewContext(dummyOctokit, "https://github.com/ncaq/konoka/pull/0")).rejects.toThrow();
  });

  test("PR番号が負の場合はローカル解決にフォールスルーする", async () => {
    await expect(detectReviewContext(dummyOctokit, "https://github.com/ncaq/konoka/pull/-1")).rejects.toThrow();
  });

  test("PR番号が数値でない場合はローカル解決にフォールスルーする", async () => {
    await expect(detectReviewContext(dummyOctokit, "https://github.com/ncaq/konoka/pull/abc")).rejects.toThrow();
  });
});
