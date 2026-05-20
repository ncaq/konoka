import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { NodeContext } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { Effect, Exit, Option } from "effect";
import { afterEach, describe, expect } from "vitest";
import { readCommitInstructions } from "../src/read-commit-instructions";

const instructionsRelPath = join(".github", "git-commit-instructions.md");

describe("readCommitInstructions", () => {
  const originalCwd = process.cwd();
  afterEach(() => {
    // readCommitInstructionsはcwd相対のパスを読むため、テストごとにcwdを戻します。
    process.chdir(originalCwd);
  });

  it.effect("ファイルが存在すれば内容を`Option.some`で返す", () =>
    Effect.gen(function* () {
      const dir = mkdtempSync(join(tmpdir(), "commit-instructions-"));
      mkdirSync(join(dir, ".github"));
      writeFileSync(join(dir, instructionsRelPath), "プロジェクト固有のガイドライン");
      process.chdir(dir);
      const result = yield* readCommitInstructions;
      expect(Option.isSome(result)).toBe(true);
      if (Option.isSome(result)) {
        expect(result.value).toBe("プロジェクト固有のガイドライン");
      }
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.effect("ファイルが存在しなければ`Option.none`を返す", () =>
    Effect.gen(function* () {
      const dir = mkdtempSync(join(tmpdir(), "commit-instructions-"));
      process.chdir(dir);
      const result = yield* readCommitInstructions;
      expect(Option.isNone(result)).toBe(true);
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.effect("NotFound以外の読み取りエラーはそのまま失敗として伝播する", () =>
    Effect.gen(function* () {
      const dir = mkdtempSync(join(tmpdir(), "commit-instructions-"));
      // パスがディレクトリだとreadFileStringはNotFound以外のエラー(EISDIR)になり、Option.noneに丸められず失敗するはずです。
      mkdirSync(join(dir, ".github"));
      mkdirSync(join(dir, instructionsRelPath));
      process.chdir(dir);
      const exit = yield* Effect.exit(readCommitInstructions);
      expect(Exit.isFailure(exit)).toBe(true);
    }).pipe(Effect.provide(NodeContext.layer)),
  );
});
