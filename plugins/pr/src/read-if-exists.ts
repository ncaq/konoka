import { FileSystem, Effect, Option } from "effect";
import type { PlatformError } from "effect/PlatformError";

/**
 * UTF-8としてファイルを読み、存在しない場合は`Option.none`を返します。
 */
export function readIfExists(
  path: string,
): Effect.Effect<Option.Option<string>, PlatformError, FileSystem.FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    return yield* fs.readFileString(path, "utf8").pipe(
      Effect.map(Option.some),
      Effect.catchReason("PlatformError", "NotFound", () => Effect.succeed(Option.none<string>())),
    );
  });
}

/**
 * ディレクトリの内容を読み、存在しない場合は`Option.none`を返します。
 */
export function readdirIfExists(
  path: string,
): Effect.Effect<Option.Option<readonly string[]>, PlatformError, FileSystem.FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    return yield* fs.readDirectory(path).pipe(
      Effect.map((entries): Option.Option<readonly string[]> => Option.some(entries)),
      Effect.catchReason("PlatformError", "NotFound", () =>
        Effect.succeed(Option.none<readonly string[]>()),
      ),
    );
  });
}

/**
 * ディレクトリエントリを大文字小文字を区別せずに検索します。
 *
 * GitHubは`CONTRIBUTING.md`や`pull_request_template.md`などの特殊ファイルを大文字小文字を区別せずに認識します。
 * コード上の候補を正規の表記1つに絞り、実行時にファイルシステム側のバリエーションを吸収します。
 */
export function findCaseInsensitive(
  dir: string,
  name: string,
): Effect.Effect<Option.Option<string>, PlatformError, FileSystem.FileSystem> {
  return readdirIfExists(dir).pipe(
    Effect.map((entries) =>
      Option.flatMap(entries, (list) => {
        const lower = name.toLowerCase();
        const found = list.toSorted().find((entry) => entry.toLowerCase() === lower);
        return Option.fromNullishOr(found);
      }),
    ),
  );
}
