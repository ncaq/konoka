import { Command } from "@effect/platform";
import type { CommandExecutor } from "@effect/platform/CommandExecutor";
import type { PlatformError } from "@effect/platform/Error";
import { String, Data, Effect, Option, pipe, Stream } from "effect";

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

/**
 * `Stream`を`string`にお手軽に変換します。
 */
const runString = <E, R>(stream: Stream.Stream<Uint8Array, E, R>): Effect.Effect<string, E, R> =>
  stream.pipe(Stream.decodeText(), Stream.runFold(String.empty, String.concat));

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
      const command = Command.make(cmd, ...args);
      const [exitCode, stdout, stderr] = yield* pipe(
        // Start running the command and return a handle to the running process
        Command.start(command),
        Effect.flatMap((process) =>
          Effect.all(
            [
              // Waits for the process to exit and returns
              // the ExitCode of the command that was run
              process.exitCode,
              // The standard output stream of the process
              runString(process.stdout),
              // The standard error stream of the process
              runString(process.stderr),
            ],
            { concurrency: 3 },
          ),
        ),
      );
      if (exitCode !== 0) {
        return yield* new CommandFailedError({
          command: cmd,
          args,
          exitCode,
          stderr,
        });
      }
      return stdout;
    }),
  );
}

/**
 * `runStdout`のバリアントです。
 * 非0終了による失敗のみを`Option.none`に畳み、
 * プロセス起動自体の失敗は依然として伝播します。
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
