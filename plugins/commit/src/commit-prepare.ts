import type { Path, FileSystem } from "effect";
import { Terminal, Effect } from "effect";
import type { PlatformError } from "effect/PlatformError";
import type { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import { createWorkdirPath } from "./create-workdir";
import { getEditmsgPath } from "./get-editmsg-path";
import { EmptyCommitError, writePatch } from "./write-patch";

/**
 * Gitリポジトリを整理して必要なパスをJSON形式で標準出力に出力します。
 * 何もステージできるものが無い場合は失敗します。
 */
export const prepareCommit: Effect.Effect<
  void,
  PlatformError | EmptyCommitError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner | Terminal.Terminal
> = Effect.gen(function* () {
  const terminal = yield* Terminal.Terminal;
  const workdirPath = yield* createWorkdirPath;
  const [editmsgPath, patchPath] = yield* Effect.all(
    [getEditmsgPath(workdirPath), writePatch(workdirPath)],
    {
      concurrency: 2,
    },
  );
  const report = { editmsgPath, patchPath };
  yield* terminal.display(`${JSON.stringify(report)}\n`);
});
