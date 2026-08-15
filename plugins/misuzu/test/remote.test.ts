import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { getRemoteName, getRemoteRepo, NoGitRemotes } from "../src/remote";
import { FakeCommandError, fakeCommandExecutor, type CommandHandler } from "./fake-command";

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
            Effect.fail(new FakeCommandError({ message: "fatal: no upstream configured" })),
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
            Effect.fail(new FakeCommandError({ message: "fatal: no upstream configured" })),
            Effect.succeed("\n"),
          ]),
        ),
      ),
    ),
  );

  it.effect("upstream出力にスラッシュが含まれない場合はgit remoteへフォールバックする", () =>
    getRemoteName().pipe(
      Effect.tap((name) => Effect.sync(() => expect(name).toBe("origin"))),
      Effect.provide(
        fakeCommandExecutor(
          sequenceHandler([
            // detached HEADなどでupstream取得がリモート名を含まない値を返すケース。
            Effect.succeed("HEAD\n"),
            Effect.succeed("origin\n"),
          ]),
        ),
      ),
    ),
  );

  it.effect("upstream出力の先頭にスラッシュがある場合もgit remoteへフォールバックする", () =>
    getRemoteName().pipe(
      Effect.tap((name) => Effect.sync(() => expect(name).toBe("origin"))),
      Effect.provide(
        fakeCommandExecutor(
          sequenceHandler([
            // 先頭スラッシュはリモート名が空になる異常出力なので採用しない仕様です。
            Effect.succeed("/master\n"),
            Effect.succeed("origin\n"),
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

  it.effect("owner/nameが取れないURLはRemoteUrlParseErrorで失敗する", () =>
    getRemoteRepo().pipe(
      Effect.flip,
      Effect.tap((err) =>
        Effect.sync(() =>
          expect(err).toMatchObject({
            _tag: "RemoteUrlParseError",
            url: "https://example.com/repo.git",
          }),
        ),
      ),
      Effect.provide(
        fakeCommandExecutor(
          sequenceHandler([
            Effect.succeed("origin/master\n"),
            // ownerに相当するパスセグメントを持たないURL。
            Effect.succeed("https://example.com/repo.git\n"),
          ]),
        ),
      ),
    ),
  );

  it.effect("git remote get-url自体が失敗した場合はそのまま失敗する", () =>
    getRemoteRepo().pipe(
      Effect.flip,
      Effect.tap((err) => Effect.sync(() => expect(err).toBeInstanceOf(FakeCommandError))),
      Effect.provide(
        fakeCommandExecutor(
          sequenceHandler([
            Effect.succeed("origin/master\n"),
            Effect.fail(new FakeCommandError({ message: "fatal: no such remote" })),
          ]),
        ),
      ),
    ),
  );

  it.effect("解決済みのリモート名を渡した場合はリモート名の解決を省略する", () =>
    getRemoteRepo("upstream").pipe(
      Effect.tap((repo) =>
        Effect.sync(() =>
          expect(repo).toEqual({
            remoteName: "upstream",
            owner: "test-owner",
            repo: "test-repo",
          }),
        ),
      ),
      Effect.provide(
        // 1回目の呼び出しがget-urlになる=getRemoteNameのgit呼び出しが省略されている。
        fakeCommandExecutor(
          sequenceHandler([Effect.succeed("https://github.com/test-owner/test-repo.git\n")]),
        ),
      ),
    ),
  );
});
