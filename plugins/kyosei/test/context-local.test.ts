import type { Octokit } from "octokit";
import { describe, expect, test } from "vitest";
import { resolveLocalContext } from "../src/context-local";

const dummyOctokit = {} as Octokit;

describe("resolveLocalContext", () => {
  // サンドボックス環境はgitリポジトリではないのでブランチ解決が失敗してrejectされることを確認します。
  test("gitリポジトリ外ではrejectされる", async () => {
    await expect(resolveLocalContext(dummyOctokit)).rejects.toThrow();
  });
});
