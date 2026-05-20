import { chdir, cwd } from "node:process";
import { FileSystem, Path } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { Effect, Exit, Option } from "effect";
import { afterEach, assert, describe, expect } from "vitest";
import { readCommitInstructions } from "../src/read-commit-instructions";

describe("readCommitInstructions", () => {
  const originalCwd = cwd();
  afterEach(() => {
    // readCommitInstructionsはcwd相対のパスを読むため、テストごとにcwdを戻します。
    chdir(originalCwd);
  });

  it.scoped("ファイルが存在すれば内容を`Option.some`で返す", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped();
      yield* fs.makeDirectory(path.join(dir, ".github"));
      yield* fs.writeFileString(
        path.join(dir, ".github", "git-commit-instructions.md"),
        "プロジェクト固有のガイドライン",
      );
      chdir(dir);
      const result = yield* readCommitInstructions;
      assert(Option.isSome(result));
      expect(result.value).toBe("プロジェクト固有のガイドライン");
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("ファイルが存在しなければ`Option.none`を返す", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const dir = yield* fs.makeTempDirectoryScoped();
      chdir(dir);
      const result = yield* readCommitInstructions;
      expect(Option.isNone(result)).toBe(true);
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("NotFound以外の読み取りエラーはそのまま失敗として伝播する", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped();
      // パスがディレクトリだとreadFileStringはNotFound以外のエラー(EISDIR)になり、Option.noneに丸められず失敗するはずです。
      yield* fs.makeDirectory(path.join(dir, ".github", "git-commit-instructions.md"), {
        recursive: true,
      });
      chdir(dir);
      const exit = yield* Effect.exit(readCommitInstructions);
      expect(Exit.isFailure(exit)).toBe(true);
    }).pipe(Effect.provide(NodeContext.layer)),
  );
});
