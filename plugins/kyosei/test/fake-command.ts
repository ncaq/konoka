/**
 * テスト用のフェイク`ChildProcessSpawner`を構築するヘルパー。
 * `ChildProcessSpawner.string`の呼び出しだけをハンドラに委譲し、
 * 他のメソッドは未対応としてメッセージ付きで`die`します。
 * テストがgitコマンド等の出力を制御したい時に使用します。
 */

import { Data, Effect, Layer, Stream } from "effect";
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
 * バリアントを呼び出し側で直接見ずに統一的に扱うためのものです。
 */
function firstStandardCommand(command: ChildProcess.Command): ChildProcess.StandardCommand {
  return command._tag === "StandardCommand" ? command : firstStandardCommand(command.left);
}

/** 未対応のメソッドが呼ばれた時のdefect。どのメソッドかをメッセージに含めます。 */
function unsupported(method: string): Error {
  return new Error(`fakeCommandExecutor: ${method} is not supported`);
}

/** `ChildProcessSpawner`をフェイク実装で差し替える`Layer`を返します。 */
export function fakeCommandExecutor(
  handler: CommandHandler,
): Layer.Layer<ChildProcessSpawner.ChildProcessSpawner> {
  const fake: ChildProcessSpawner.ChildProcessSpawner["Service"] = {
    spawn: () => Effect.die(unsupported("spawn")),
    exitCode: () => Effect.die(unsupported("exitCode")),
    streamString: () => Stream.die(unsupported("streamString")),
    streamLines: () => Stream.die(unsupported("streamLines")),
    lines: () => Effect.die(unsupported("lines")),
    string: (command) => {
      const standard = firstStandardCommand(command);
      return handler(standard.command, standard.args) as Effect.Effect<string, PlatformError>;
    },
  };
  return Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, fake);
}
