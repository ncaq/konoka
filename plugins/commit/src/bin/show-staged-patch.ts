import { NodeServices, NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { Argument, Command } from "effect/cli";
import { showStagedPatch } from "../show-staged-patch";

/**
 * 表示対象のパッチファイル。
 */
const patchPath = Argument.File("patch", { mustExist: true });

/**
 * コマンド処理の本体。
 */
const command = Command.make("show-staged-patch", { patchPath }, ({ patchPath }) =>
  showStagedPatch(patchPath),
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
