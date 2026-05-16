import { tmpdir } from "node:os";
import { FileSystem, Path } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { Config, Effect } from "effect";

const pluginName = "pr" as const;
const fileName = "PULLREQ_EDITMSG" as const;

export interface PrepareEditmsgOptions {
  /**
   * テスト用の基底ディレクトリ上書きオプション。
   * 通常用途では指定しません。
   * 指定された場合は`coding-agent-work/`サブパスを付けずに基底ディレクトリとして使います。
   */
  readonly runtimeDir?: string;
}

const personalWorkDir: Effect.Effect<string> = Config.nonEmptyString("XDG_RUNTIME_DIR").pipe(
  Effect.orElseSucceed(() => tmpdir()),
);

const codingAgentWorkDir: Effect.Effect<string, never, Path.Path> = Effect.gen(function* () {
  const path = yield* Path.Path;
  const base = yield* personalWorkDir;
  return path.join(base, "coding-agent-work", pluginName);
});

/**
 * セッション固有の一時ディレクトリを作成し、`PULLREQ_EDITMSG`ファイルのフルパスを返します。
 *
 * 作業ディレクトリの基底は`$XDG_RUNTIME_DIR/coding-agent-work/pr/`を使い、
 * 未設定環境では`os.tmpdir()`にフォールバックします。
 * 親ディレクトリが無い場合は再帰的に作成し、
 * その下に`makeTempDirectory`でセッション固有のサブディレクトリを掘ります。
 * `PULLREQ_EDITMSG`本体は呼び出し側でこのパスに書き出してください。
 */
export function prepareEditmsg(
  options: PrepareEditmsgOptions = {},
): Effect.Effect<string, PlatformError, FileSystem.FileSystem | Path.Path> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const override =
      options.runtimeDir != null && options.runtimeDir !== "" ? options.runtimeDir : undefined;
    const baseDir = override ?? (yield* codingAgentWorkDir);
    yield* fs.makeDirectory(baseDir, { recursive: true, mode: 0o700 });
    const sessionDir = yield* fs.makeTempDirectory({ directory: baseDir, prefix: "session-" });
    return path.join(sessionDir, fileName);
  });
}
