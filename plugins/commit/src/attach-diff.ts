import { FileSystem } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { Effect } from "effect";

/**
 * Gitが`--verbose`などで、
 * コミットメッセージとdiffの仕切りに使う、
 * scissors line。
 * 各種エディタやツールはこの行を目印にして挙動を変えます。
 * scissors line以外の用途ではこのテキストは入っていないことを前提にします。
 */
const scissorsLine = "# ------------------------ >8 ------------------------\n" as const;

/**
 * `COMMIT_EDITMSG`ファイルに`git commit --verbose`のようにdiff patchデータを追加します。
 * 人間がdiffを見ながらコミットメッセージを書けるようになります。
 * またGitHub Copilotなどのツールも文脈を読み取って提案が向上します。
 */
export function appendDiffToEditmsg(
  commitEditmsgPath: string,
  patchPath: string,
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const commitEditmsg = (yield* fs.readFileString(commitEditmsgPath)).trim();
    const patch = (yield* fs.readFileString(patchPath)).trim();
    const content = `${commitEditmsg}\n${scissorsLine}${patch}`;
    yield* fs.writeFileString(commitEditmsgPath, content);
  });
}

/**
 * `COMMIT_EDITMSG`ファイルからdiff patchデータを削除します。
 * `git commit --verbose --cleanup=scissors`で削除する方針は、
 * `commit-msg`フックなどが削除する前に参照するようになっているため、
 * scissorsを考慮しないツールでエラーを引き起こしてしまいます。
 * よってこちらでテキストエディタの編集終了後に明示的に削除します。
 */
export function removeDiffFromEditmsg(
  commitEditmsgPath: string,
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const oldCommitEditmsg = yield* fs.readFileString(commitEditmsgPath);
    const newCommitEditmsg = oldCommitEditmsg.replace(new RegExp(`${scissorsLine}.*`), "");
    yield* fs.writeFileString(commitEditmsgPath, newCommitEditmsg);
  });
}
