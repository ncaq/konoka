import { Command, FileSystem, Terminal } from "@effect/platform";
import type { CommandExecutor } from "@effect/platform/CommandExecutor";
import type { PlatformError } from "@effect/platform/Error";
import { Config, Console, Effect, Option, Stream } from "effect";

/**
 * 環境変数`COLUMNS`が使えないときにdeltaへ渡す既定の表示幅です。
 */
export const defaultWidth = 100 as const;

/**
 * deltaに指定する表示幅を決定します。
 *
 * Bashツールのような非TTYの出力先では端末幅を検出できず、
 * `--width`を明示しないとdeltaは80桁にフォールバックします。
 * そのため環境変数`COLUMNS`が正の整数ならその値を、
 * 未設定または不正な値なら`defaultWidth`を使います。
 */
export const displayWidth: Effect.Effect<number> = Config.integer("COLUMNS").pipe(
  Config.validate({
    message: "COLUMNS must be a positive integer",
    validation: (columns) => 0 < columns,
  }),
  Effect.orElseSucceed(() => defaultWidth),
);

/**
 * deltaでパッチをシンタックスハイライトして、
 * ANSIエスケープシーケンス付きの文字列を返します。
 *
 * deltaの起動に失敗した場合や非0で終了した場合は、
 * 理由を標準エラー出力に書き出して`Option.none`を返します。
 * deltaは任意の依存であり、
 * 無い環境でも素のパッチ表示で目的を果たせるからです。
 */
function highlightWithDelta(
  patch: string,
  width: number,
): Effect.Effect<Option.Option<string>, never, CommandExecutor> {
  return Effect.gen(function* () {
    const delta = Command.make("delta", "--paging=never", `--width=${width}`).pipe(
      Command.feed(patch),
      Command.stderr("inherit"),
    );
    const deltaProcess = yield* Command.start(delta);
    const [highlighted, exitCode] = yield* Effect.all(
      [Stream.mkString(Stream.decodeText(deltaProcess.stdout)), deltaProcess.exitCode],
      { concurrency: "unbounded" },
    );
    if (exitCode !== 0) {
      yield* Console.error(`delta exited with code ${exitCode}. Falling back to the plain patch.`);
      return Option.none<string>();
    }
    return Option.some(highlighted);
  }).pipe(
    Effect.scoped,
    Effect.catchAll((error) =>
      Console.error(`Failed to run delta: ${error.message}. Falling back to the plain patch.`).pipe(
        Effect.as(Option.none<string>()),
      ),
    ),
  );
}

/**
 * ステージされた差分のパッチファイルをユーザ向けに表示します。
 *
 * deltaが利用できる環境ではシンタックスハイライト付きで表示し、
 * 利用できない環境では素のパッチをそのまま表示します。
 */
export function showStagedPatch(
  patchPath: string,
): Effect.Effect<void, PlatformError, CommandExecutor | FileSystem.FileSystem | Terminal.Terminal> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const terminal = yield* Terminal.Terminal;
    const patch = yield* fs.readFileString(patchPath);
    const width = yield* displayWidth;
    const highlighted = yield* highlightWithDelta(patch, width);
    yield* terminal.display(Option.getOrElse(highlighted, () => patch));
  });
}
