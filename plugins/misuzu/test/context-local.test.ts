import { it } from "@effect/vitest";
import { Effect } from "effect";
import type { Octokit } from "octokit";
import { describe, expect, vi } from "vitest";
import { resolveLocalContext } from "../src/context-local";
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
  reposGet: ReturnType<typeof vi.fn>;
}

function makeOctokitRestMock(
  pulls: readonly { number: number; base: { ref: string } }[],
  defaultBranch: string,
): OctokitRestMock {
  const pullsList = vi.fn().mockResolvedValue({ data: pulls });
  const reposGet = vi.fn().mockResolvedValue({ data: { default_branch: defaultBranch } });
  const octokit = {
    rest: { pulls: { list: pullsList }, repos: { get: reposGet } },
  } as unknown as Octokit;
  return { octokit, pullsList, reposGet };
}

describe("resolveLocalContext", () => {
  // ブランチ解決の入口で必ずgitが必要なので、
  // フェイクで全コマンドを失敗させてrejectされることを確認します。
  it.effect("コマンド実行が全て失敗する場合は失敗で抜ける", () =>
    resolveLocalContext(dummyOctokit).pipe(
      Effect.flip,
      Effect.tap((err) => Effect.sync(() => expect(err).toBeInstanceOf(FakeCommandError))),
      Effect.provide(
        fakeCommandExecutor(() =>
          Effect.fail(new FakeCommandError({ message: "simulated git failure" })),
        ),
      ),
    ),
  );

  it.effect("ブランチに紐付くPRが見つかればprとbaseブランチを設定する", () => {
    const { octokit, pullsList, reposGet } = makeOctokitRestMock(
      [{ number: 42, base: { ref: "develop" } }],
      "master",
    );
    return Effect.gen(function* () {
      const context = yield* resolveLocalContext(octokit);
      expect(context).toEqual({
        output: "local",
        pr: { owner: "ncaq", repo: "konoka", prNumber: 42 },
        baseBranch: "develop",
        remoteName: "origin",
      });
      // headパラメータがowner付きの形式で組まれていることを固定します。
      expect(pullsList).toHaveBeenCalledWith({
        owner: "ncaq",
        repo: "konoka",
        head: "ncaq:feature",
        state: "open",
        per_page: 1,
      });
      expect(reposGet).not.toHaveBeenCalled();
    }).pipe(Effect.provide(fakeCommandExecutor(gitHandler(githubGitOutputs))));
  });

  it.effect("PRが見つからない場合はデフォルトブランチにフォールバックする", () => {
    const { octokit } = makeOctokitRestMock([], "main");
    return Effect.gen(function* () {
      const context = yield* resolveLocalContext(octokit);
      expect(context).toEqual({
        output: "local",
        baseBranch: "main",
        remoteName: "origin",
      });
    }).pipe(Effect.provide(fakeCommandExecutor(gitHandler(githubGitOutputs))));
  });

  it.effect("GitHubリポジトリが特定できない場合はsymbolic-refからデフォルトブランチを取る", () =>
    Effect.gen(function* () {
      const context = yield* resolveLocalContext(dummyOctokit);
      expect(context).toEqual({
        output: "local",
        baseBranch: "master",
        remoteName: "origin",
      });
    }).pipe(
      Effect.provide(
        fakeCommandExecutor(
          gitHandler({
            ...githubGitOutputs,
            // GitHub形式として解釈できないリモートURL。
            "git remote get-url origin": "https://example.com/repo.git\n",
            "git symbolic-ref refs/remotes/origin/HEAD": "refs/remotes/origin/master\n",
          }),
        ),
      ),
    ),
  );

  it.effect("symbolic-refの出力が想定形式でない場合は失敗する", () =>
    resolveLocalContext(dummyOctokit).pipe(
      Effect.flip,
      Effect.tap((err) =>
        Effect.sync(() => expect(err).toMatchObject({ _tag: "UnexpectedSymbolicRefFormat" })),
      ),
      Effect.provide(
        fakeCommandExecutor(
          gitHandler({
            ...githubGitOutputs,
            "git remote get-url origin": "https://example.com/repo.git\n",
            // リモート名のprefixを持たない想定外の出力。
            "git symbolic-ref refs/remotes/origin/HEAD": "refs/heads/master\n",
          }),
        ),
      ),
    ),
  );
});
