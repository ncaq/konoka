import process from "node:process";
import { Args, Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { showStagedPatch } from "../show-staged-patch";

/**
 * 表示対象のパッチファイル。
 */
const patchPath = Args.file({ name: "patch", exists: "yes" });

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
  name: "show-staged-patch",
  version: "0.0.0", // あくまで内部プログラムでありバージョンはプラグイン側にあるのでダミー。
});

function main(): void {
  NodeRuntime.runMain(cli(process.argv).pipe(Effect.provide(NodeContext.layer)));
}

main();
