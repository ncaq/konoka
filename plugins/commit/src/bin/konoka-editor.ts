import process from "node:process";
import { Args, Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { konokaEdit } from "../konoka-editor";

/**
 * `COMMIT_EDITMSG`ファイル。
 */
const commitEditmsgPath = Args.file({ name: "COMMIT_EDITMSG", exists: "yes" });

/**
 * 差分のパッチファイル。
 */
const patchPathArg = Args.file({ name: "git-diff-for-commit.patch", exists: "yes" });

/**
 * コマンド処理の本体。
 */
const command = Command.make(
  "konoka-editor",
  { commitEditmsgPath, patchPathArg },
  ({ commitEditmsgPath, patchPathArg }) => konokaEdit(commitEditmsgPath, patchPathArg),
);

/**
 * メタデータを含んだコマンド全体。
 */
const cli = Command.run(command, {
  name: "konoka-editor",
  version: "0.0.0", // あくまで内部プログラムでありバージョンはプラグイン側にあるのでダミー。
});

function main(): void {
  NodeRuntime.runMain(cli(process.argv).pipe(Effect.provide(NodeContext.layer)));
}

main();
