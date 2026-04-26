import { Effect } from "effect";
import type { Octokit } from "octokit";
import { describe, expect, test } from "vitest";
import { resolveLocalContext } from "../src/context-local";
import { fakeCommandExecutor } from "./fake-command";

const dummyOctokit = {} as Octokit;

describe("resolveLocalContext", () => {
  // ブランチ解決の入口で必ずgitが必要なので、フェイクで全コマンドを失敗させてrejectされることを確認します。
  test("コマンド実行が全て失敗する場合はrejectされる", async () => {
    const layer = fakeCommandExecutor(() => Effect.fail(new Error("simulated git failure")));
    await expect(Effect.runPromise(resolveLocalContext(dummyOctokit).pipe(Effect.provide(layer)))).rejects.toThrow();
  });
});
