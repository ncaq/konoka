import { chdir, cwd } from "node:process";
import { Command, FileSystem, Path } from "@effect/platform";
import type { CommandExecutor } from "@effect/platform/CommandExecutor";
import type { PlatformError } from "@effect/platform/Error";
import { NodeContext } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { Cause, Effect, Exit, Option, Scope } from "effect";
import { afterEach, assert, describe, expect } from "vitest";
import { EmptyCommitError, writePatch } from "../src/write-patch";

/** 指定ディレクトリでgitコマンドを実行し、標準出力を返します。 */
function gitIn(
  cwd: string,
  ...args: readonly string[]
): Effect.Effect<string, PlatformError, CommandExecutor> {
  return Command.make("git", ...args).pipe(Command.workingDirectory(cwd), Command.string);
}

/** スコープに紐づく一時ディレクトリに空のGitリポジトリを初期化してそのパスを返します。 */
const initRepo: Effect.Effect<
  string,
  PlatformError,
  FileSystem.FileSystem | CommandExecutor | Scope.Scope
> = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const dir = yield* fs.makeTempDirectoryScoped();
  yield* gitIn(dir, "init", "--quiet");
  return dir;
});

describe("writePatch", () => {
  const originalCwd = cwd();
  afterEach(() => {
    // writePatchはcwdのGitリポジトリを操作するため、テストごとにcwdを戻します。
    chdir(originalCwd);
  });

  it.scoped("変更が何も無ければ`EmptyCommitError`で失敗する", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const repo = yield* initRepo;
      const workdir = yield* fs.makeTempDirectoryScoped();
      chdir(repo);
      const exit = yield* Effect.exit(writePatch(workdir));
      assert(Exit.isFailure(exit));
      const failure = Cause.failureOption(exit.cause);
      assert(Option.isSome(failure));
      expect(failure.value).toBeInstanceOf(EmptyCommitError);
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("未ステージの変更を自動でステージしてpatchファイルを書き出す", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repo = yield* initRepo;
      yield* fs.writeFileString(path.join(repo, "a.txt"), "hello\n");
      const workdir = yield* fs.makeTempDirectoryScoped();
      chdir(repo);
      const patchPath = yield* writePatch(workdir);
      expect(patchPath).toBe(path.join(workdir, "git-diff-for-commit.patch"));
      // 実際にファイルが書き出され、内容が`git diff --cached`と一致することを確認します。
      const expected = (yield* gitIn(
        repo,
        "diff",
        "--cached",
        "--no-color",
        "--no-ext-diff",
      )).trimEnd();
      const actual = yield* fs.readFileString(patchPath);
      expect(actual).toBe(expected);
      expect(actual).toContain("a.txt");
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("既にステージ済みの変更からpatchファイルを書き出す", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repo = yield* initRepo;
      yield* fs.writeFileString(path.join(repo, "b.txt"), "world\n");
      yield* gitIn(repo, "add", "b.txt");
      const workdir = yield* fs.makeTempDirectoryScoped();
      chdir(repo);
      const patchPath = yield* writePatch(workdir);
      expect(yield* fs.readFileString(patchPath)).toContain("b.txt");
    }).pipe(Effect.provide(NodeContext.layer)),
  );
});
