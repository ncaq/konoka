import { describe, expect, test, vi } from "vitest";
import { execFileAsync } from "../src/exec";
import { getRemoteName, getRemoteRepo } from "../src/remote";

vi.mock("../src/exec", () => ({
  execFileAsync: vi.fn(),
}));

const mockedExecFileAsync = vi.mocked(execFileAsync);

describe("getRemoteName", () => {
  test("upstreamが設定されている場合はupstreamからリモート名を取得する", async () => {
    mockedExecFileAsync.mockResolvedValueOnce({
      stdout: "origin/master\n",
      stderr: "",
    } as Awaited<ReturnType<typeof execFileAsync>>);

    const remoteName = await getRemoteName();

    expect(remoteName).toBe("origin");
  });

  test("upstreamが設定されていない場合はgit remoteの先頭を使う", async () => {
    const execError = new Error("fatal: no upstream configured") as Error & { cmd: string };
    execError.cmd = "git rev-parse";
    mockedExecFileAsync
      // 1回目: upstream取得が失敗
      .mockRejectedValueOnce(execError)
      // 2回目: git remote
      .mockResolvedValueOnce({
        stdout: "upstream\norigin\n",
        stderr: "",
      } as Awaited<ReturnType<typeof execFileAsync>>);

    const remoteName = await getRemoteName();

    expect(remoteName).toBe("upstream");
  });

  test("リモートが1つも設定されていない場合はエラーを投げる", async () => {
    const execError = new Error("fatal: no upstream configured") as Error & { cmd: string };
    execError.cmd = "git rev-parse";
    mockedExecFileAsync.mockRejectedValueOnce(execError).mockResolvedValueOnce({
      stdout: "\n",
      stderr: "",
    } as Awaited<ReturnType<typeof execFileAsync>>);

    await expect(getRemoteName()).rejects.toThrow("no git remotes configured");
  });
});

describe("getRemoteRepo", () => {
  test("リモートURLからowner/repoを解析する", async () => {
    mockedExecFileAsync
      // getRemoteName: upstream取得
      .mockResolvedValueOnce({
        stdout: "origin/master\n",
        stderr: "",
      } as Awaited<ReturnType<typeof execFileAsync>>)
      // getRemoteRepo: remote get-url
      .mockResolvedValueOnce({
        stdout: "https://github.com/test-owner/test-repo.git\n",
        stderr: "",
      } as Awaited<ReturnType<typeof execFileAsync>>);

    const remoteRepo = await getRemoteRepo();

    expect(remoteRepo).toEqual({
      remoteName: "origin",
      owner: "test-owner",
      repo: "test-repo",
    });
  });

  test("SSH形式のURLも解析できる", async () => {
    mockedExecFileAsync
      .mockResolvedValueOnce({
        stdout: "origin/master\n",
        stderr: "",
      } as Awaited<ReturnType<typeof execFileAsync>>)
      .mockResolvedValueOnce({
        stdout: "git@github.com:test-owner/test-repo.git\n",
        stderr: "",
      } as Awaited<ReturnType<typeof execFileAsync>>);

    const remoteRepo = await getRemoteRepo();

    expect(remoteRepo).toEqual({
      remoteName: "origin",
      owner: "test-owner",
      repo: "test-repo",
    });
  });
});
