import { FileSystem, Path } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { NodeContext } from "@effect/platform-node";
import { describe, it } from "@effect/vitest";
import { Cause, ConfigProvider, Effect, Exit, Option, Scope } from "effect";
import { assert, expect } from "vitest";
import { EditorFailedError, konokaEdit } from "../src/konoka-editor";

/**
 * `konokaEdit`が読み書きするCOMMIT_EDITMSGとpatchファイルを、
 * スコープに紐づく一時ディレクトリに用意してそれぞれのパスを返します。
 */
const setupFiles: Effect.Effect<
  { readonly editmsgPath: string; readonly patchPath: string },
  PlatformError,
  FileSystem.FileSystem | Path.Path | Scope.Scope
> = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = yield* fs.makeTempDirectoryScoped();
  const editmsgPath = path.join(dir, "COMMIT_EDITMSG");
  const patchPath = path.join(dir, "git-diff-for-commit.patch");
  yield* fs.writeFileString(editmsgPath, "feat: test message\n");
  yield* fs.writeFileString(patchPath, "diff --git a/x.ts b/x.ts\n");
  return { editmsgPath, patchPath };
});

describe("konokaEdit", () => {
  it.scoped("`EDITOR`が0で終わる場合は成功する", () =>
    Effect.gen(function* () {
      const { editmsgPath, patchPath } = yield* setupFiles;
      yield* konokaEdit(editmsgPath, patchPath).pipe(
        Effect.withConfigProvider(ConfigProvider.fromMap(new Map([["EDITOR", "true"]]))),
      );
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("`EDITOR`が非0で終わる場合は終了コードを含む`EditorFailedError`で失敗する", () =>
    Effect.gen(function* () {
      const { editmsgPath, patchPath } = yield* setupFiles;
      const exit = yield* Effect.exit(
        konokaEdit(editmsgPath, patchPath).pipe(
          Effect.withConfigProvider(ConfigProvider.fromMap(new Map([["EDITOR", "false"]]))),
        ),
      );
      assert(Exit.isFailure(exit));
      const failure = Cause.failureOption(exit.cause);
      assert(Option.isSome(failure));
      assert(failure.value instanceof EditorFailedError);
      expect(failure.value.exitCode).toBe(1);
      expect(failure.value.message).toContain("exit code 1");
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("引数のCOMMIT_EDITMSGパスが`$1`としてエディタに渡る", () =>
    Effect.gen(function* () {
      const { editmsgPath, patchPath } = yield* setupFiles;
      // 内側に`sh -c`をもう一段噛ませることで、`"$@"`を素直な位置引数として受け取り、
      // `$1`が`konokaEdit`に渡したCOMMIT_EDITMSGパスと一致するかを終了コードで判定します。
      const editor = `sh -c 'test "$1" = "${editmsgPath}"' --`;
      yield* konokaEdit(editmsgPath, patchPath).pipe(
        Effect.withConfigProvider(ConfigProvider.fromMap(new Map([["EDITOR", editor]]))),
      );
    }).pipe(Effect.provide(NodeContext.layer)),
  );
});
