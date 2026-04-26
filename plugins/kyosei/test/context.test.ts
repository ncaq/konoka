import { Effect } from "effect";
import type { Octokit } from "octokit";
import { describe, expect, test } from "vitest";
import { detectReviewContext } from "../src/context";
import { fakeCommandExecutor } from "./fake-command";

const dummyOctokit = {} as Octokit;

const failingCommandLayer = fakeCommandExecutor(() => Effect.fail(new Error("simulated git failure")));

const runDetect = (argument: string | undefined): Promise<unknown> =>
  Effect.runPromise(detectReviewContext(dummyOctokit, argument).pipe(Effect.provide(failingCommandLayer)));

describe("detectReviewContext", () => {
  // PR URLでない引数はローカル解決にフォールスルーするので、フェイクgitが失敗することでrejectされます。
  test("undefinedの場合はローカル解決にフォールスルーする", async () => {
    await expect(runDetect(undefined)).rejects.toThrow();
  });

  test("空文字の場合はローカル解決にフォールスルーする", async () => {
    await expect(runDetect("")).rejects.toThrow();
  });

  test("空白のみの場合はローカル解決にフォールスルーする", async () => {
    await expect(runDetect("   ")).rejects.toThrow();
  });

  test("URLではない文字列の場合はローカル解決にフォールスルーする", async () => {
    await expect(runDetect("not-a-url")).rejects.toThrow();
  });

  test("PR URLではないGitHub URLの場合はローカル解決にフォールスルーする", async () => {
    await expect(runDetect("https://github.com/ncaq/konoka")).rejects.toThrow();
  });

  test("issueのURLの場合はローカル解決にフォールスルーする", async () => {
    await expect(runDetect("https://github.com/ncaq/konoka/issues/42")).rejects.toThrow();
  });

  test("PR番号が0の場合はローカル解決にフォールスルーする", async () => {
    await expect(runDetect("https://github.com/ncaq/konoka/pull/0")).rejects.toThrow();
  });

  test("PR番号が負の場合はローカル解決にフォールスルーする", async () => {
    await expect(runDetect("https://github.com/ncaq/konoka/pull/-1")).rejects.toThrow();
  });

  test("PR番号が数値でない場合はローカル解決にフォールスルーする", async () => {
    await expect(runDetect("https://github.com/ncaq/konoka/pull/abc")).rejects.toThrow();
  });
});
