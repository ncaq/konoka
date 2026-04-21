import type { Octokit } from "octokit";
import { describe, expect, test, vi } from "vitest";
import { getChangeset } from "../src/changeset.js";
import type { GitHubOutputContext, LocalOutputContext } from "../src/context-type.js";

vi.mock("../src/exec.js", () => ({
  execFileAsync: vi.fn(),
}));

import { execFileAsync } from "../src/exec.js";

const mockedExecFileAsync = vi.mocked(execFileAsync);

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

      const changeset = await getChangeset(octokit, context);

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

      await expect(getChangeset(octokit, context)).rejects.toThrow("unexpected response type for diff");
    });
  });

  describe("ローカル出力モード", () => {
    test("remoteNameがある場合はremoteName/baseBranch...HEADでdiffを取得する", async () => {
      const context: LocalOutputContext = {
        output: "local",
        baseBranch: "master",
        remoteName: "origin",
      };
      mockedExecFileAsync.mockImplementation((_cmd, args) => {
        if (Array.isArray(args) && args.at(0) === "diff") {
          return Promise.resolve({ stdout: "local diff", stderr: "" }) as ReturnType<typeof execFileAsync>;
        }
        return Promise.resolve({ stdout: "local log", stderr: "" }) as ReturnType<typeof execFileAsync>;
      });

      const changeset = await getChangeset({} as Octokit, context);

      expect(changeset.diff).toBe("local diff");
      expect(changeset.log).toBe("local log");
      expect(mockedExecFileAsync).toHaveBeenCalledWith("git", ["diff", "--end-of-options", "origin/master...HEAD"]);
      expect(mockedExecFileAsync).toHaveBeenCalledWith("git", ["log", "--end-of-options", "origin/master...HEAD"]);
    });

    test("remoteNameがない場合はbaseBranch...HEADでdiffを取得する", async () => {
      const context: LocalOutputContext = {
        output: "local",
        baseBranch: "master",
      };
      mockedExecFileAsync.mockImplementation(() => {
        return Promise.resolve({ stdout: "", stderr: "" }) as ReturnType<typeof execFileAsync>;
      });

      await getChangeset({} as Octokit, context);

      expect(mockedExecFileAsync).toHaveBeenCalledWith("git", ["diff", "--end-of-options", "master...HEAD"]);
      expect(mockedExecFileAsync).toHaveBeenCalledWith("git", ["log", "--end-of-options", "master...HEAD"]);
    });
  });
});
