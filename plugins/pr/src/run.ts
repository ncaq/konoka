import { Command } from "@effect/platform";
import type { CommandExecutor } from "@effect/platform/CommandExecutor";
import type { PlatformError } from "@effect/platform/Error";
import { Data, Effect, Option, Stream } from "effect";

/**
 * 子プロセスが非0で終了した場合に投げる構造化エラーです。
 * `stderr`は子プロセスからの標準エラー出力をそのまま保持しますが、
 * 取得できなかった場合は空文字列で構いません。
 */
export class CommandFailedError extends Data.TaggedError("CommandFailedError")<{
  readonly command: string;
  readonly args: readonly string[];
  readonly exitCode: number;
  readonly stderr: string;
}> {
  override get message(): string {
    const cmdline = [this.command, ...this.args].join(" ");
    const head = `Command failed: ${cmdline} (exit ${this.exitCode})`;
    return this.stderr === "" ? head : `${head}\n${this.stderr}`;
  }
}

function concatBytes(acc: Uint8Array, curr: Uint8Array): Uint8Array {
  const out = new Uint8Array(acc.length + curr.length);
  out.set(acc);
  out.set(curr, acc.length);
  return out;
}

/**
 * 子プロセスを実行し、標準出力をtrim済みの文字列で返します。
 * 終了コードが0以外の場合は標準エラー出力を含む`CommandFailedError`で失敗します。
 */
export function runStdout(
  cmd: string,
  args: readonly string[],
): Effect.Effect<string, CommandFailedError | PlatformError, CommandExecutor> {
  return Effect.scoped(
    Effect.gen(function* () {
      const process = yield* Command.start(Command.make(cmd, ...args));
      const decoder = new TextDecoder();
      const [stdoutBytes, stderrBytes, exitCode] = yield* Effect.all(
        [
          Stream.runFold(process.stdout, new Uint8Array(), concatBytes),
          Stream.runFold(process.stderr, new Uint8Array(), concatBytes),
          process.exitCode,
        ],
        { concurrency: "unbounded" },
      );
      if (exitCode !== 0) {
        return yield* new CommandFailedError({
          command: cmd,
          args,
          exitCode,
          stderr: decoder.decode(stderrBytes).trim(),
        });
      }
      return decoder.decode(stdoutBytes).trim();
    }),
  );
}

/**
 * `runStdout`の失敗を握り潰す版です。
 * upstream未設定時の`git rev-parse @{u}`のように、
 * 失敗自体が情報として意味を持つ呼び出しで使います。
 */
export function tryRunStdout(
  cmd: string,
  args: readonly string[],
): Effect.Effect<Option.Option<string>, PlatformError, CommandExecutor> {
  return runStdout(cmd, args).pipe(
    Effect.map(Option.some),
    Effect.catchTag("CommandFailedError", () => Effect.succeed(Option.none<string>())),
  );
}
