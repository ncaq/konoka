import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { NodeContext } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { Cause, Effect, Exit, Option } from "effect";
import { afterEach, assert, describe, expect } from "vitest";
import { EmptyCommitError, writePatch } from "../src/write-patch";

/** 一時ディレクトリに空のGitリポジトリを初期化してそのパスを返します。 */
function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "commit-writepatch-"));
  execFileSync("git", ["init", "--quiet"], { cwd: dir });
  return dir;
}

describe("writePatch", () => {
  const originalCwd = process.cwd();
  afterEach(() => {
    // writePatchはcwdのGitリポジトリを操作するため、テストごとにcwdを戻します。
    process.chdir(originalCwd);
  });

  it.effect("変更が何も無ければ`EmptyCommitError`で失敗する", () =>
    Effect.gen(function* () {
      const repo = initRepo();
      const workdir = mkdtempSync(join(tmpdir(), "commit-workdir-"));
      process.chdir(repo);
      const exit = yield* Effect.exit(writePatch(workdir));
      assert(Exit.isFailure(exit));
      const failure = Cause.failureOption(exit.cause);
      assert(Option.isSome(failure));
      expect(failure.value).toBeInstanceOf(EmptyCommitError);
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.effect("未ステージの変更を自動でステージしてpatchファイルを書き出す", () =>
    Effect.gen(function* () {
      const repo = initRepo();
      writeFileSync(join(repo, "a.txt"), "hello\n");
      const workdir = mkdtempSync(join(tmpdir(), "commit-workdir-"));
      process.chdir(repo);
      const patchPath = yield* writePatch(workdir);
      expect(patchPath).toBe(join(workdir, "git-diff-for-commit.patch"));
      // 実際にファイルが書き出され、内容が`git diff --cached`と一致することを確認します。
      const expected = execFileSync("git", ["diff", "--cached", "--no-color", "--no-ext-diff"], {
        cwd: repo,
      })
        .toString()
        .trimEnd();
      expect(readFileSync(patchPath, "utf8")).toBe(expected);
      expect(readFileSync(patchPath, "utf8")).toContain("a.txt");
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.effect("既にステージ済みの変更からpatchファイルを書き出す", () =>
    Effect.gen(function* () {
      const repo = initRepo();
      writeFileSync(join(repo, "b.txt"), "world\n");
      execFileSync("git", ["add", "b.txt"], { cwd: repo });
      const workdir = mkdtempSync(join(tmpdir(), "commit-workdir-"));
      process.chdir(repo);
      const patchPath = yield* writePatch(workdir);
      expect(readFileSync(patchPath, "utf8")).toContain("b.txt");
    }).pipe(Effect.provide(NodeContext.layer)),
  );
});
