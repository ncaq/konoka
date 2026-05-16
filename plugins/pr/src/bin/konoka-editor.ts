import process from "node:process";
import { Args, Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { konokaEdit } from "../konoka-editor";

/**
 * コマンドライン引数として渡された`PULLREQ_EDITMSG`ファイル。
 */
const pullreqEditmsgArg = Args.file({ name: "PULLREQ_EDITMSG", exists: "yes" });

/**
 * コマンド処理の本体。
 */
const command = Command.make("konoka-editor", { pullreqEditmsgArg }, ({ pullreqEditmsgArg }) =>
  konokaEdit(pullreqEditmsgArg),
);

/**
 * メタデータを含んだコマンド全体。
 */
const cli = Command.run(command, {
  name: "konoka-editor",
  version: "0.0.0", // あくまで内部プログラムでありバージョンはプラグイン側にあるのでダミー。
});

/**
 * エントリーポイントとしてコマンドを起動します。
 */
function main(): void {
  cli(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);
}

main();
