import { Effect } from "effect";
import type { Octokit } from "octokit";
import { describe, expect, test, vi } from "vitest";
import { getChangeset } from "../src/changeset";
import type { GitHubOutputContext, LocalOutputContext } from "../src/context-type";
import { fakeCommandExecutor } from "./fake-command";

describe("getChangeset", () => {
  describe("GitHub出力モード", () => {
    test("PRのdiffとコミットログを取得する", async () => {
      const context: GitHubOutputContext = {
        output: "github",
        host: "github.com",
        pr: { owner: "test-owner", repo: "test-repo", prNumber: 42 },
      };
      const octokit = {
        rest: {
          pulls: {
            get: vi.fn().mockResolvedValue({ data: "diff content here" }),
            listCommits: vi.fn(),
          },
        },
        paginate: vi.fn().mockResolvedValue([
          {
            sha: "abc123",
            commit: {
              author: { name: "Test Author", date: "2026-01-01T00:00:00Z" },
              message: "test commit message",
            },
          },
        ]),
      } as unknown as Octokit;

      const layer = fakeCommandExecutor(() => Effect.die(new Error("git should not be invoked in GitHub mode")));
      const changeset = await Effect.runPromise(getChangeset(octokit, context).pipe(Effect.provide(layer)));

      expect(changeset.diff).toBe("diff content here");
      expect(changeset.log).toContain("abc123");
      expect(changeset.log).toContain("Test Author");
      expect(changeset.log).toContain("test commit message");
      expect(octokit.paginate).toHaveBeenCalledWith(octokit.rest.pulls.listCommits, {
        owner: "test-owner",
        repo: "test-repo",
        pull_number: 42,
        per_page: 100,
      });
    });

    test("diffレスポンスが文字列でない場合はエラーを投げる", async () => {
      const context: GitHubOutputContext = {
        output: "github",
        host: "github.com",
        pr: { owner: "test-owner", repo: "test-repo", prNumber: 42 },
      };
      const octokit = {
        rest: {
          pulls: {
            get: vi.fn().mockResolvedValue({ data: { not: "a string" } }),
            listCommits: vi.fn(),
          },
        },
        paginate: vi.fn().mockResolvedValue([]),
      } as unknown as Octokit;

      const layer = fakeCommandExecutor(() => Effect.die(new Error("git should not be invoked in GitHub mode")));
      await expect(Effect.runPromise(getChangeset(octokit, context).pipe(Effect.provide(layer)))).rejects.toThrow(
        "unexpected response type for diff",
      );
    });
  });

  describe("ローカル出力モード", () => {
    test("remoteNameがある場合はremoteName/baseBranch...HEADでdiffを取得する", async () => {
      const context: LocalOutputContext = {
        output: "local",
        baseBranch: "master",
        remoteName: "origin",
      };
      const calls: { command: string; args: readonly string[] }[] = [];
      const layer = fakeCommandExecutor((command, args) => {
        calls.push({ command, args });
        if (args.at(0) === "diff") {
          return Effect.succeed("local diff");
        }
        return Effect.succeed("local log");
      });

      const changeset = await Effect.runPromise(getChangeset({} as Octokit, context).pipe(Effect.provide(layer)));

      expect(changeset.diff).toBe("local diff");
      expect(changeset.log).toBe("local log");
      expect(calls).toContainEqual({ command: "git", args: ["diff", "--end-of-options", "origin/master...HEAD"] });
      expect(calls).toContainEqual({ command: "git", args: ["log", "--end-of-options", "origin/master...HEAD"] });
    });

    test("remoteNameがない場合はbaseBranch...HEADでdiffを取得する", async () => {
      const context: LocalOutputContext = {
        output: "local",
        baseBranch: "master",
      };
      const calls: { command: string; args: readonly string[] }[] = [];
      const layer = fakeCommandExecutor((command, args) => {
        calls.push({ command, args });
        return Effect.succeed("");
      });

      await Effect.runPromise(getChangeset({} as Octokit, context).pipe(Effect.provide(layer)));

      expect(calls).toContainEqual({ command: "git", args: ["diff", "--end-of-options", "master...HEAD"] });
      expect(calls).toContainEqual({ command: "git", args: ["log", "--end-of-options", "master...HEAD"] });
    });
  });
});
