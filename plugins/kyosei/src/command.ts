/**
 * 子プロセス実行の薄いヘルパーモジュール。
 */

import { Effect } from "effect";
import type { PlatformError } from "effect/PlatformError";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

/**
 * コマンドを実行して標準出力を文字列で返します。
 * 終了コードは検査しません。
 * 起動失敗などのプラットフォームエラーは`PlatformError`として失敗します。
 */
export function commandString(
  command: string,
  args: readonly string[],
): Effect.Effect<string, PlatformError, ChildProcessSpawner.ChildProcessSpawner> {
  return Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    return yield* spawner.string(ChildProcess.make(command, args));
  });
}
