import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
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
  it.effect("upstreamが設定されている場合はupstreamからリモート名を取得する", () =>
    getRemoteName().pipe(
      Effect.tap((name) => Effect.sync(() => expect(name).toBe("origin"))),
      Effect.provide(fakeCommandExecutor(sequenceHandler([Effect.succeed("origin/master\n")]))),
    ),
  );

  it.effect("upstreamが設定されていない場合はgit remoteの先頭を使う", () =>
    getRemoteName().pipe(
      Effect.tap((name) => Effect.sync(() => expect(name).toBe("upstream"))),
      Effect.provide(
        fakeCommandExecutor(
          sequenceHandler([
            Effect.fail(new Error("fatal: no upstream configured")),
            Effect.succeed("upstream\norigin\n"),
          ]),
        ),
      ),
    ),
  );

  it.effect("リモートが1つも設定されていない場合はNoGitRemotesで失敗する", () =>
    getRemoteName().pipe(
      Effect.flip,
      Effect.tap((err) => Effect.sync(() => expect(err).toBeInstanceOf(NoGitRemotes))),
      Effect.provide(
        fakeCommandExecutor(
          sequenceHandler([
            Effect.fail(new Error("fatal: no upstream configured")),
            Effect.succeed("\n"),
          ]),
        ),
      ),
    ),
  );
});

describe("getRemoteRepo", () => {
  it.effect("リモートURLからowner/repoを解析する", () =>
    getRemoteRepo().pipe(
      Effect.tap((repo) =>
        Effect.sync(() =>
          expect(repo).toEqual({
            remoteName: "origin",
            owner: "test-owner",
            repo: "test-repo",
          }),
        ),
      ),
      Effect.provide(
        fakeCommandExecutor(
          sequenceHandler([
            Effect.succeed("origin/master\n"),
            Effect.succeed("https://github.com/test-owner/test-repo.git\n"),
          ]),
        ),
      ),
    ),
  );

  it.effect("SSH形式のURLも解析できる", () =>
    getRemoteRepo().pipe(
      Effect.tap((repo) =>
        Effect.sync(() =>
          expect(repo).toEqual({
            remoteName: "origin",
            owner: "test-owner",
            repo: "test-repo",
          }),
        ),
      ),
      Effect.provide(
        fakeCommandExecutor(
          sequenceHandler([
            Effect.succeed("origin/master\n"),
            Effect.succeed("git@github.com:test-owner/test-repo.git\n"),
          ]),
        ),
      ),
    ),
  );
});
