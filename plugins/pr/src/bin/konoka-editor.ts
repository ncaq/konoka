import { NodeServices, NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { Argument, Command } from "effect/cli";
import { konokaEdit } from "../konoka-editor";

/**
 * コマンドライン引数として渡された`PULLREQ_EDITMSG`ファイル。
 */
const pullreqEditmsgArg = Argument.File("PULLREQ_EDITMSG", { mustExist: true });

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
  version: "0.0.0", // あくまで内部プログラムでありバージョンはプラグイン側にあるのでダミー。
});

/**
 * エントリーポイントとしてコマンドを起動します。
 */
function main(): void {
  cli.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
}

main();
