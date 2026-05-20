import { FileSystem, Path } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { Effect, Option } from "effect";
import { findCaseInsensitive, readIfExists } from "./read-if-exists";

/**
 * `CONTRIBUTING`ガイドラインの検索場所。
 * GitHubの表示優先度の順に並べ、最初に見つかったものを採用します。
 */
const contributingLocations = [".github", ".", "docs"] as const;

/**
 * 正規のファイル名。大文字小文字のバリエーションは実行時に吸収します。
 */
const contributingName = "CONTRIBUTING.md" as const;

export interface ContributingFile {
  readonly path: string;
  readonly content: string;
}

function readAtLocation(
  root: string,
  location: string,
): Effect.Effect<
  Option.Option<ContributingFile>,
  PlatformError,
  FileSystem.FileSystem | Path.Path
> {
  return Effect.gen(function* () {
    const path = yield* Path.Path;
    const dir = path.join(root, location);
    const found = yield* findCaseInsensitive(dir, contributingName);
    if (Option.isNone(found)) {
      return Option.none<ContributingFile>();
    }
    const relativePath = location === "." ? found.value : path.join(location, found.value);
    const content = yield* readIfExists(path.join(root, relativePath));
    return Option.map(content, (c) => ({ path: relativePath, content: c }));
  });
}

/**
 * リポジトリの`CONTRIBUTING`ガイドラインがあれば読み込みます。
 *
 * @param root 検索ルート。省略時はカレントディレクトリ。
 */
export function readContributing(
  root = ".",
): Effect.Effect<
  Option.Option<ContributingFile>,
  PlatformError,
  FileSystem.FileSystem | Path.Path
> {
  return Effect.gen(function* () {
    const candidates = yield* Effect.all(
      contributingLocations.map((location) => readAtLocation(root, location)),
      { concurrency: "unbounded" },
    );
    return Option.fromNullable(candidates.find(Option.isSome)).pipe(Option.flatten);
  });
}

/**
 * `CONTRIBUTING`ファイルをmarkdownのセクションとして整形します。
 */
export function formatContributing(file: ContributingFile): string {
  return `# ${file.path}\n\n${file.content}`;
}
