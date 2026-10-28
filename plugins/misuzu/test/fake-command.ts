/**
 * テスト用のフェイク`ChildProcessSpawner`を構築するヘルパー。
 * `ChildProcessSpawner.string`の呼び出しだけをハンドラに委譲し、
 * 他のメソッドは未対応として`die`します。
 * テストがgitコマンド等の出力を制御したい時に使用します。
 */

import { Data, Effect, Layer } from "effect";
import type { PlatformError } from "effect/PlatformError";
import type { ChildProcess } from "effect/process";
import { ChildProcessSpawner } from "effect/process";

/** テストでコマンド実行の失敗を模倣するためのタグ付きエラー。 */
export class FakeCommandError extends Data.TaggedError("FakeCommandError")<{
  readonly message: string;
}> {}

/**
 * コマンド名と引数列に対する`stdout`をEffectで返すハンドラ。
 */
export type CommandHandler = (
  command: string,
  args: readonly string[],
) => Effect.Effect<string, Error>;

/**
 * pipedな構造があっても先頭の`StandardCommand`を取り出します。
 */
function firstStandardCommand(cmd: ChildProcess.Command): ChildProcess.StandardCommand {
  return cmd._tag === "StandardCommand" ? cmd : firstStandardCommand(cmd.left);
}

/** `ChildProcessSpawner`をフェイク実装で差し替える`Layer`を返します。 */
export function fakeCommandExecutor(
  handler: CommandHandler,
): Layer.Layer<ChildProcessSpawner.ChildProcessSpawner> {
  const unsupported = (): never => {
    throw new Error("fakeCommandExecutor: only `string` is supported");
  };
  const fake: ChildProcessSpawner.ChildProcessSpawner["Service"] = {
    spawn: () => Effect.die(new Error("fakeCommandExecutor: spawn is not supported")),
    exitCode: () => Effect.die(new Error("fakeCommandExecutor: exitCode is not supported")),
    streamString: unsupported,
    streamLines: unsupported,
    lines: () => Effect.die(new Error("fakeCommandExecutor: lines is not supported")),
    string: (cmd) => {
      const standard = firstStandardCommand(cmd);
      return handler(standard.command, standard.args) as Effect.Effect<string, PlatformError>;
    },
  };
  return Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, fake);
}
