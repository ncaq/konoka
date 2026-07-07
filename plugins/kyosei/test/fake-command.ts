/**
 * テスト用のフェイク`CommandExecutor`を構築するヘルパー。
 * `Command.string`の呼び出しだけをハンドラに委譲し、
 * 他のメソッドは未対応として`die`します。
 * テストがgitコマンド等の出力を制御したい時に使用します。
 */

import { Command, CommandExecutor } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { Data, Effect, Layer } from "effect";

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

/** `CommandExecutor`をフェイク実装で差し替える`Layer`を返します。 */
export function fakeCommandExecutor(
  handler: CommandHandler,
): Layer.Layer<CommandExecutor.CommandExecutor> {
  const fake: Pick<CommandExecutor.CommandExecutor, "string"> = {
    // `Command.flatten`はpipedな構造があっても先頭の`StandardCommand`を取り出せるので、
    // バリアントを直接見ずに統一的に扱えます。
    string: (cmd) => {
      const [standard] = Command.flatten(cmd);
      if (standard == null) {
        return Effect.die(new Error("fakeCommandExecutor: empty Command.flatten result"));
      }
      return handler(standard.command, standard.args) as Effect.Effect<string, PlatformError>;
    },
  };
  return Layer.succeed(CommandExecutor.CommandExecutor, fake as CommandExecutor.CommandExecutor);
}
