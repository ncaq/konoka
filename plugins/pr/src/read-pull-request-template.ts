import { FileSystem, Path } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { Effect, Option } from "effect";
import { findCaseInsensitive, readIfExists, readdirIfExists } from "./read-if-exists";

/**
 * pull requestテンプレートの検索場所。
 * GitHubの表示優先度の順に並べ、全マッチを返します。
 */
const templateLocations = [".github", "docs", "."] as const;

/**
 * 単一ファイル形式の正規ファイル名。大文字小文字のバリエーションは実行時に吸収します。
 */
const templateFileName = "pull_request_template.md" as const;

/**
 * 複数テンプレート形式の正規ディレクトリ名。大文字小文字のバリエーションは実行時に吸収します。
 */
const templateDirName = "PULL_REQUEST_TEMPLATE" as const;

export interface PullRequestTemplate {
  readonly path: string;
  readonly content: string;
}

function readSingleAtLocation(
  root: string,
  location: string,
): Effect.Effect<
  Option.Option<PullRequestTemplate>,
  PlatformError,
  FileSystem.FileSystem | Path.Path
> {
  return Effect.gen(function* () {
    const path = yield* Path.Path;
    const dir = path.join(root, location);
    const found = yield* findCaseInsensitive(dir, templateFileName);
    if (Option.isNone(found)) {
      return Option.none<PullRequestTemplate>();
    }
    const relativePath = location === "." ? found.value : path.join(location, found.value);
    const content = yield* readIfExists(path.join(root, relativePath));
    return Option.map(content, (c) => ({ path: relativePath, content: c }));
  });
}

function readMultiAtLocation(
  root: string,
  location: string,
): Effect.Effect<readonly PullRequestTemplate[], PlatformError, FileSystem.FileSystem | Path.Path> {
  return Effect.gen(function* () {
    const path = yield* Path.Path;
    const dir = path.join(root, location);
    const found = yield* findCaseInsensitive(dir, templateDirName);
    if (Option.isNone(found)) {
      return [] as readonly PullRequestTemplate[];
    }
    const templateDir = location === "." ? found.value : path.join(location, found.value);
    const entries = yield* readdirIfExists(path.join(root, templateDir));
    if (Option.isNone(entries)) {
      return [] as readonly PullRequestTemplate[];
    }
    const mdEntries = entries.value.filter((entry) => entry.toLowerCase().endsWith(".md"));
    const templates = yield* Effect.all(
      mdEntries.map((entry) =>
        Effect.gen(function* () {
          const relativePath = path.join(templateDir, entry);
          const content = yield* readIfExists(path.join(root, relativePath));
          return Option.map(
            content,
            (c): PullRequestTemplate => ({ path: relativePath, content: c }),
          );
        }),
      ),
      { concurrency: "unbounded" },
    );
    return templates.filter(Option.isSome).map((opt) => opt.value);
  });
}

/**
 * リポジトリに存在する全てのpull requestテンプレートを読み込みます。
 *
 * 単一ファイル形式と複数ファイル形式の両方を走査します。
 *
 * @param root 検索ルート。省略時はカレントディレクトリ。
 */
export function readPullRequestTemplates(
  root = ".",
): Effect.Effect<readonly PullRequestTemplate[], PlatformError, FileSystem.FileSystem | Path.Path> {
  return Effect.gen(function* () {
    const [singleResults, multiResults] = yield* Effect.all(
      [
        Effect.all(
          templateLocations.map((location) => readSingleAtLocation(root, location)),
          { concurrency: "unbounded" },
        ),
        Effect.all(
          templateLocations.map((location) => readMultiAtLocation(root, location)),
          { concurrency: "unbounded" },
        ),
      ],
      { concurrency: "unbounded" },
    );
    return [...singleResults.filter(Option.isSome).map((opt) => opt.value), ...multiResults.flat()];
  });
}

/**
 * pull requestテンプレート群を1つのmarkdown文書として整形します。
 *
 * 各テンプレートを区切り線で連結したセクションとしてレンダリングします。
 */
export function formatPullRequestTemplates(templates: readonly PullRequestTemplate[]): string {
  return templates.map(({ path, content }) => `# ${path}\n\n${content}`).join("\n\n---\n\n");
}
