import { Effect } from "effect";
import { describe, expect, test } from "vitest";
import { getRemoteName, getRemoteRepo, NoGitRemotes } from "../src/remote";
import { fakeCommandExecutor, type CommandHandler } from "./fake-command";

const sequenceHandler = (responses: Effect.Effect<string, Error>[]): CommandHandler => {
  let index = 0;
  return () => {
    const next = responses[index++];
    if (next == null) {
      return Effect.die(new Error(`unexpected command call #${index}`));
    }
    return next;
  };
};

describe("getRemoteName", () => {
  test("upstreamが設定されている場合はupstreamからリモート名を取得する", async () => {
    const layer = fakeCommandExecutor(sequenceHandler([Effect.succeed("origin/master\n")]));

    const remoteName = await Effect.runPromise(getRemoteName().pipe(Effect.provide(layer)));

    expect(remoteName).toBe("origin");
  });

  test("upstreamが設定されていない場合はgit remoteの先頭を使う", async () => {
    const layer = fakeCommandExecutor(
      sequenceHandler([Effect.fail(new Error("fatal: no upstream configured")), Effect.succeed("upstream\norigin\n")]),
    );

    const remoteName = await Effect.runPromise(getRemoteName().pipe(Effect.provide(layer)));

    expect(remoteName).toBe("upstream");
  });

  test("リモートが1つも設定されていない場合はNoGitRemotesで失敗する", async () => {
    const layer = fakeCommandExecutor(
      sequenceHandler([Effect.fail(new Error("fatal: no upstream configured")), Effect.succeed("\n")]),
    );

    // `Effect.flip`で成功/失敗を入れ替えて失敗値を直接assertします。
    const error = await Effect.runPromise(Effect.flip(getRemoteName().pipe(Effect.provide(layer))));

    expect(error).toBeInstanceOf(NoGitRemotes);
  });
});

describe("getRemoteRepo", () => {
  test("リモートURLからowner/repoを解析する", async () => {
    const layer = fakeCommandExecutor(
      sequenceHandler([
        Effect.succeed("origin/master\n"),
        Effect.succeed("https://github.com/test-owner/test-repo.git\n"),
      ]),
    );

    const remoteRepo = await Effect.runPromise(getRemoteRepo().pipe(Effect.provide(layer)));

    expect(remoteRepo).toEqual({
      remoteName: "origin",
      owner: "test-owner",
      repo: "test-repo",
    });
  });

  test("SSH形式のURLも解析できる", async () => {
    const layer = fakeCommandExecutor(
      sequenceHandler([Effect.succeed("origin/master\n"), Effect.succeed("git@github.com:test-owner/test-repo.git\n")]),
    );

    const remoteRepo = await Effect.runPromise(getRemoteRepo().pipe(Effect.provide(layer)));

    expect(remoteRepo).toEqual({
      remoteName: "origin",
      owner: "test-owner",
      repo: "test-repo",
    });
  });
});
