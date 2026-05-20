import type { Path, FileSystem } from "@effect/platform";
import { Terminal } from "@effect/platform";
import type { CommandExecutor } from "@effect/platform/CommandExecutor";
import type { PlatformError } from "@effect/platform/Error";
import { Effect } from "effect";
import { createWorkdirPath } from "./create-workdir";
import { writeEditmsgSkeleton } from "./write-editmsg-skeleton";
import { EmptyCommitError, writePatch } from "./write-patch";

/**
 * Gitリポジトリを整理して必要なパスをJSON形式で返します。
 * 何もステージできるものが無い場合は失敗します。
 */
export const prepareCommit: Effect.Effect<
  void,
  PlatformError | EmptyCommitError,
  FileSystem.FileSystem | Path.Path | CommandExecutor | Terminal.Terminal
> = Effect.gen(function* () {
  const terminal = yield* Terminal.Terminal;
  const workdirPath = yield* createWorkdirPath;
  const [editmsgPath, patchPath] = yield* Effect.all(
    [writeEditmsgSkeleton(workdirPath), writePatch(workdirPath)],
    {
      concurrency: 2,
    },
  );
  const report = { editmsgPath, patchPath };
  terminal.display(`${JSON.stringify(report)}\n`);
});
