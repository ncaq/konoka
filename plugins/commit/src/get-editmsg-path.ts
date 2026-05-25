import { Path } from "@effect/platform";
import { Effect } from "effect";

/**
 * `COMMIT_EDITMSG`ファイルのパスを返します。
 * ファイル自体は作成しません。
 * 空ファイルを作るとAIが`Write`ツールで書き込む前に読み込みを強いられて無駄なので、
 * パスの計算のみを行います。
 */
export function getEditmsgPath(workdirPath: string): Effect.Effect<string, never, Path.Path> {
  return Effect.gen(function* () {
    const path = yield* Path.Path;
    return path.join(workdirPath, "COMMIT_EDITMSG");
  });
}
