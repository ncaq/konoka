/**
 * テスト用のフェイク`CommandExecutor`を構築するヘルパー。
 * `Command.string`の呼び出しだけをハンドラに委譲し、他のメソッドは未対応として`die`します。
 * テストがgitコマンド等の出力を制御したい時に使用します。
 */

import { Command, CommandExecutor } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { Effect, Layer } from "effect";

/**
 * コマンド名と引数列に対する`stdout`をEffectで返すハンドラ。
 * 失敗時のエラーは任意の`Error`を許容します(本番では`PlatformError`ですが、テストでは生`Error`を流しやすくするため)。
 */
export type CommandHandler = (command: string, args: readonly string[]) => Effect.Effect<string, Error>;

/** `CommandExecutor`をフェイク実装で差し替える`Layer`を返します。 */
export function fakeCommandExecutor(handler: CommandHandler): Layer.Layer<CommandExecutor.CommandExecutor> {
  const fake: Pick<CommandExecutor.CommandExecutor, "string"> = {
    // `Command.flatten`はpipedな構造があっても先頭の`StandardCommand`を取り出せるので、
    // バリアントを直接見ずに統一的に扱えます。テストではpipedは使わない前提で先頭のみ参照します。
    string: (cmd) => {
      const [standard] = Command.flatten(cmd);
      if (standard == null) {
        return Effect.die(new Error("fakeCommandExecutor: empty Command.flatten result"));
      }
      // テスト用に`Error`で失敗させたものは`PlatformError`として扱われますが、
      // テスト側では`Effect.either`等で受け取って中身を比較するだけなので、型情報を緩めて流しています。
      return handler(standard.command, standard.args) as Effect.Effect<string, PlatformError>;
    },
  };
  return Layer.succeed(CommandExecutor.CommandExecutor, fake as CommandExecutor.CommandExecutor);
}
