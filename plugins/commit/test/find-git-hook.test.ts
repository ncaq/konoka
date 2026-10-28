import { chdir, cwd } from "node:process";
import { NodeServices } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { Cause, Effect, Exit, FileSystem, Option, Path, type Scope } from "effect";
import type { PlatformError } from "effect/PlatformError";
import { ChildProcess } from "effect/process";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import { afterEach, assert, describe, expect } from "vitest";
import {
  findGitHook,
  GitCommandFailedError,
  gitHooksPath,
  gitTopLevel,
} from "../src/find-git-hook";

/**
 * スコープに紐づく一時ディレクトリにGitリポジトリを初期化して、
 * フックディレクトリを専用の一時ディレクトリに向けたリポジトリのパスを返します。
 *
 * `core.hooksPath`をリポジトリごとに設定するのは、
 * ユーザのグローバル設定のフックがテストへ紛れ込まないようにするためです。
 */
const initRepo: Effect.Effect<
  { readonly repo: string; readonly hooks: string },
  PlatformError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner | Scope.Scope
> = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repo = yield* fs.makeTempDirectoryScoped();
  const hooks = path.join(repo, "git-hooks");
  yield* fs.makeDirectory(hooks);
  const spawner = yield* ChildProcessSpawner;
  yield* spawner.exitCode(ChildProcess.make("git", ["init", "--quiet"], { cwd: repo }));
  yield* spawner.exitCode(
    ChildProcess.make("git", ["config", "core.hooksPath", hooks], { cwd: repo }),
  );
  return { repo, hooks };
});

describe("findGitHook", () => {
  const originalCwd = cwd();
  afterEach(() => {
    // gitのコマンドはcwdのリポジトリを見るため、テストごとにcwdを戻します。
    chdir(originalCwd);
  });

  it.effect("フックが存在しなければ`Option.none`を返す", () =>
    Effect.gen(function* () {
      const { repo } = yield* initRepo;
      chdir(repo);
      expect(Option.isNone(yield* findGitHook("commit-msg"))).toBe(true);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("実行可能なフックがあればそのパスを返す", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { repo, hooks } = yield* initRepo;
      const hookPath = path.join(hooks, "commit-msg");
      yield* fs.writeFileString(hookPath, "#!/bin/sh\nexit 0\n");
      yield* fs.chmod(hookPath, 0o755);
      chdir(repo);
      expect(yield* findGitHook("commit-msg")).toStrictEqual(Option.some(hookPath));
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("実行権限が無いフックはgitと同じく無いものとして扱う", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { repo, hooks } = yield* initRepo;
      const hookPath = path.join(hooks, "commit-msg");
      yield* fs.writeFileString(hookPath, "#!/bin/sh\nexit 0\n");
      yield* fs.chmod(hookPath, 0o644);
      chdir(repo);
      expect(Option.isNone(yield* findGitHook("commit-msg"))).toBe(true);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("リポジトリの外ではエラーになり検査を飛ばさない", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      // 一時ディレクトリはリポジトリの外にあるため、gitはフックディレクトリを答えられません。
      chdir(yield* fs.makeTempDirectoryScoped());
      const exit = yield* Effect.exit(findGitHook("commit-msg"));
      assert(Exit.isFailure(exit));
      const failure = Cause.findErrorOption(exit.cause);
      assert(Option.isSome(failure));
      expect(failure.value).toBeInstanceOf(GitCommandFailedError);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("`core.hooksPath`の設定をフックディレクトリとして解決する", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { repo, hooks } = yield* initRepo;
      // サブディレクトリからでも絶対パスとして解決できることを確認します。
      const sub = path.join(repo, "sub");
      yield* fs.makeDirectory(sub);
      chdir(sub);
      expect(yield* gitHooksPath).toBe(hooks);
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});

describe("gitTopLevel", () => {
  const originalCwd = cwd();
  afterEach(() => {
    chdir(originalCwd);
  });

  it.effect("サブディレクトリからでもリポジトリのルートを返す", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { repo } = yield* initRepo;
      const sub = path.join(repo, "sub");
      yield* fs.makeDirectory(sub);
      chdir(sub);
      // macOSの一時ディレクトリはシンボリックリンク経由になるため、実体のパスと比較します。
      expect(yield* gitTopLevel).toBe(yield* fs.realPath(repo));
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});
