import process from "node:process";
import { Args, Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { runCommitMsgHook } from "../run-commit-msg-hook";

/**
 * 検査対象のコミットメッセージファイル。
 */
const messagePath = Args.file({ name: "COMMIT_EDITMSG", exists: "yes" });

/**
 * コマンド処理の本体。
 */
const command = Command.make("run-commit-msg-hook", { messagePath }, ({ messagePath }) =>
  runCommitMsgHook(messagePath).pipe(
    Effect.tapErrorTag("CommitMsgHookFailedError", (err) => Console.error(err.message)),
  ),
);

/**
 * メタデータを含んだコマンド全体。
 */
const cli = Command.run(command, {
  name: "run-commit-msg-hook",
  version: "0.0.0", // あくまで内部プログラムでありバージョンはプラグイン側にあるのでダミー。
});

function main(): void {
  NodeRuntime.runMain(cli(process.argv).pipe(Effect.provide(NodeContext.layer)));
}

main();
