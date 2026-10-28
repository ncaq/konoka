import { NodeServices, NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { Argument, Command } from "effect/cli";
import { runCommitMsgHook } from "../run-commit-msg-hook";

/**
 * 検査対象のコミットメッセージファイル。
 */
const messagePath = Argument.File("COMMIT_EDITMSG", { mustExist: true });

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
  version: "0.0.0", // あくまで内部プログラムでありバージョンはプラグイン側にあるのでダミー。
});

function main(): void {
  NodeRuntime.runMain(cli.pipe(Effect.provide(NodeServices.layer)));
}

main();
