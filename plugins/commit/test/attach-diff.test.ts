import { FileSystem, Path } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { NodeContext } from "@effect/platform-node";
import { describe, it } from "@effect/vitest";
import { Effect, Scope } from "effect";
import { expect } from "vitest";
import { appendDiffToEditmsg, removeDiffFromEditmsg, scissorsLine } from "../src/attach-diff";

/**
 * 複数行のdiffを含むpatch。
 * 1行で済ませると改行をまたぐ削除のバグを見逃すので、
 * 複数行にします。
 */
const multilinePatch = [
  "diff --git a/x.ts b/x.ts",
  "index 0000000..1111111 100644",
  "--- a/x.ts",
  "+++ b/x.ts",
  "@@ -1 +1 @@",
  "-old",
  "+new",
].join("\n");

/**
 * COMMIT_EDITMSGとpatchファイルを一時ディレクトリに用意し、それぞれのパスを返します。
 */
function setupFiles(
  editmsg: string,
  patch: string,
): Effect.Effect<
  { readonly editmsgPath: string; readonly patchPath: string },
  PlatformError,
  FileSystem.FileSystem | Path.Path | Scope.Scope
> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const dir = yield* fs.makeTempDirectoryScoped();
    const editmsgPath = path.join(dir, "COMMIT_EDITMSG");
    const patchPath = path.join(dir, "git-diff-for-commit.patch");
    yield* fs.writeFileString(editmsgPath, editmsg);
    yield* fs.writeFileString(patchPath, patch);
    return { editmsgPath, patchPath };
  });
}

describe("appendDiffToEditmsg", () => {
  it.scoped("メッセージの後ろにscissors lineとpatchを連結する", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { editmsgPath, patchPath } = yield* setupFiles("feat: x\n", multilinePatch);
      yield* appendDiffToEditmsg(editmsgPath, patchPath);
      const result = yield* fs.readFileString(editmsgPath);
      expect(result).toBe(`feat: x\n${scissorsLine}${multilinePatch}`);
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("メッセージとpatchの前後の空白をトリムしてから連結する", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { editmsgPath, patchPath } = yield* setupFiles(
        "\n  feat: x  \n\n",
        `\n${multilinePatch}\n`,
      );
      yield* appendDiffToEditmsg(editmsgPath, patchPath);
      const result = yield* fs.readFileString(editmsgPath);
      expect(result).toBe(`feat: x\n${scissorsLine}${multilinePatch}`);
    }).pipe(Effect.provide(NodeContext.layer)),
  );
});

describe("removeDiffFromEditmsg", () => {
  it.scoped("scissors line以降の複数行patchを末尾まで削除する", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { editmsgPath, patchPath } = yield* setupFiles("feat: x\n", multilinePatch);
      yield* appendDiffToEditmsg(editmsgPath, patchPath);
      yield* removeDiffFromEditmsg(editmsgPath);
      const result = yield* fs.readFileString(editmsgPath);
      expect(result).not.toContain(scissorsLine.trimEnd());
      expect(result).not.toContain("diff --git");
      expect(result).not.toContain("+new");
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("削除後はコミットメッセージ本文だけが残る", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { editmsgPath, patchPath } = yield* setupFiles("feat: x\n", multilinePatch);
      yield* appendDiffToEditmsg(editmsgPath, patchPath);
      yield* removeDiffFromEditmsg(editmsgPath);
      const result = yield* fs.readFileString(editmsgPath);
      expect(result.trim()).toBe("feat: x");
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("複数行メッセージのappend/removeラウンドトリップで本文を保持する", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const message = "feat: x\n\n本文の1行目。\n本文の2行目。";
      const { editmsgPath, patchPath } = yield* setupFiles(message, multilinePatch);
      yield* appendDiffToEditmsg(editmsgPath, patchPath);
      yield* removeDiffFromEditmsg(editmsgPath);
      const result = yield* fs.readFileString(editmsgPath);
      expect(result.trim()).toBe(message);
    }).pipe(Effect.provide(NodeContext.layer)),
  );
});
