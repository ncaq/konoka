import { it } from "@effect/vitest";
import { Effect, Option } from "effect";
import type { Octokit } from "octokit";
import { describe, expect, vi } from "vitest";
import { findPrForCurrentBranch } from "../src/context-local";
import { FakeCommandError, fakeCommandExecutor, type CommandHandler } from "./fake-command";

const dummyOctokit = {} as Octokit;

/** コマンドと引数の連結文字列をキーにstdoutを返すハンドラを作ります。 */
function gitHandler(outputs: Record<string, string>): CommandHandler {
  return (command, args) => {
    const key = [command, ...args].join(" ");
    const output = outputs[key];
    if (output == null) {
      return Effect.fail(new FakeCommandError({ message: `unexpected command: ${key}` }));
    }
    return Effect.succeed(output);
  };
}

/** GitHubのリモートが設定されている場合の標準的なgit出力。 */
const githubGitOutputs = {
  "git rev-parse --abbrev-ref --symbolic-full-name @{upstream}": "origin/feature\n",
  "git rev-parse --abbrev-ref HEAD": "feature\n",
  "git remote get-url origin": "git@github.com:ncaq/konoka.git\n",
};

interface OctokitRestMock {
  octokit: Octokit;
  pullsList: ReturnType<typeof vi.fn>;
}

function makeOctokitRestMock(pulls: readonly { number: number }[]): OctokitRestMock {
  const pullsList = vi.fn().mockResolvedValue({ data: pulls });
  const octokit = {
    rest: { pulls: { list: pullsList } },
  } as unknown as Octokit;
  return { octokit, pullsList };
}

describe("findPrForCurrentBranch", () => {
  // ブランチ解決の入口で必ずgitが必要なので、
  // フェイクで全コマンドを失敗させてrejectされることを確認します。
  it.effect("コマンド実行が全て失敗する場合は失敗で抜ける", () =>
    findPrForCurrentBranch(dummyOctokit).pipe(
      Effect.flip,
      Effect.tap((err) => Effect.sync(() => expect(err).toBeInstanceOf(FakeCommandError))),
      Effect.provide(
        fakeCommandExecutor(() =>
          Effect.fail(new FakeCommandError({ message: "simulated git failure" })),
        ),
      ),
    ),
  );

  it.effect("ブランチに紐付くPRが見つかればPR識別情報を返す", () => {
    const { octokit, pullsList } = makeOctokitRestMock([{ number: 42 }]);
    return Effect.gen(function* () {
      const pr = yield* findPrForCurrentBranch(octokit);
      expect(Option.getOrUndefined(pr)).toEqual({
        owner: "ncaq",
        repo: "konoka",
        prNumber: 42,
      });
      // headパラメータがowner付きの形式で組まれていることを固定します。
      expect(pullsList).toHaveBeenCalledWith({
        owner: "ncaq",
        repo: "konoka",
        head: "ncaq:feature",
        state: "open",
        per_page: 1,
      });
    }).pipe(Effect.provide(fakeCommandExecutor(gitHandler(githubGitOutputs))));
  });

  it.effect("PRが見つからない場合はNoneを返す", () => {
    const { octokit } = makeOctokitRestMock([]);
    return Effect.gen(function* () {
      const pr = yield* findPrForCurrentBranch(octokit);
      expect(Option.isNone(pr)).toBe(true);
    }).pipe(Effect.provide(fakeCommandExecutor(gitHandler(githubGitOutputs))));
  });

  it.effect("GitHubリポジトリが特定できない場合はNoneを返す", () =>
    Effect.gen(function* () {
      const pr = yield* findPrForCurrentBranch(dummyOctokit);
      expect(Option.isNone(pr)).toBe(true);
    }).pipe(
      Effect.provide(
        fakeCommandExecutor(
          gitHandler({
            ...githubGitOutputs,
            // GitHub形式として解釈できないリモートURL。
            "git remote get-url origin": "https://example.com/repo.git\n",
          }),
        ),
      ),
    ),
  );

  it.effect("gitリモートが1つもない場合はNoneを返す", () =>
    Effect.gen(function* () {
      const pr = yield* findPrForCurrentBranch(dummyOctokit);
      expect(Option.isNone(pr)).toBe(true);
    }).pipe(
      Effect.provide(
        fakeCommandExecutor(
          gitHandler({
            // upstream未設定でgit remoteも空 = リモートなし。
            "git remote": "\n",
            "git rev-parse --abbrev-ref HEAD": "feature\n",
          }),
        ),
      ),
    ),
  );
});
