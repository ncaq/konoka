import { FileSystem, Path } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { Effect } from "effect";

/**
 * `COMMIT_EDITMSG`ファイルのスケルトンを作りそのパスを返します。
 */
export function writeEditmsgSkeleton(
  workdirPath: string,
): Effect.Effect<string, PlatformError, FileSystem.FileSystem | Path.Path> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const editmsgPath = path.join(workdirPath, "COMMIT_EDITMSG");
    yield* fs.writeFileString(editmsgPath, "");
    return editmsgPath;
  });
}
