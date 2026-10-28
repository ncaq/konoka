import { NodeServices, NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { Argument, Command } from "effect/cli";
import { konokaEdit } from "../konoka-editor";

/**
 * `COMMIT_EDITMSG`ファイル。
 */
const commitEditmsgPath = Argument.File("COMMIT_EDITMSG", { mustExist: true });

/**
 * 差分のパッチファイル。
 */
const patchPath = Argument.File("git-diff-for-commit.patch", { mustExist: true });

/**
 * コマンド処理の本体。
 */
const command = Command.make(
  "konoka-editor",
  { commitEditmsgPath, patchPath },
  ({ commitEditmsgPath, patchPath }) => konokaEdit(commitEditmsgPath, patchPath),
);

/**
 * メタデータを含んだコマンド全体。
 */
const cli = Command.run(command, {
  version: "0.0.0", // あくまで内部プログラムでありバージョンはプラグイン側にあるのでダミー。
});

function main(): void {
  NodeRuntime.runMain(cli.pipe(Effect.provide(NodeServices.layer)));
}

main();
