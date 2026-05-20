import { Command, FileSystem, Path } from "@effect/platform";
import type { CommandExecutor } from "@effect/platform/CommandExecutor";
import type { PlatformError } from "@effect/platform/Error";
import { Data, Effect } from "effect";

/** Raised when there is nothing to commit. */
export class EmptyCommitError extends Data.TaggedError("EmptyCommitError")<{
  readonly message: string;
}> {}

/**
 * gitコマンドを指定された引数で実行し、
 * 標準出力をトリムして返します。
 */
function git(...args: readonly string[]): Effect.Effect<string, PlatformError, CommandExecutor> {
  return Command.string(Command.make("git", ...args)).pipe(Effect.map((s) => s.trimEnd()));
}

/**
 * 機械に優しい方法で`git status`を出力します。
 */
function gitStatusPorcelain(): Effect.Effect<string, PlatformError, CommandExecutor> {
  return git("status", "--porcelain");
}

/**
 * 現在の状態を全てステージします。
 */
function gitAddAll(): Effect.Effect<void, PlatformError, CommandExecutor> {
  return git("add", "--all");
}

/**
 * コミット前に相応しいgitのdiffを生成します。
 */
function gitDiffForCommit(): Effect.Effect<string, PlatformError, CommandExecutor> {
  return git("diff", "--cached", "--no-color", "--no-ext-diff");
}

/**
 * `git status --porcelain`の出力から、
 * ステージされている変更があるかを判定します。
 */
export function hasStagedChanges(status: string): boolean {
  return status.split("\n").some((line) => {
    const index = line[0];
    return index != null && index !== " " && index !== "?";
  });
}

/**
 * 現在の状態をチェックして、
 * 変更があるのにステージされたファイルが存在しない場合は全てステージします。
 */
const ensureStaged: Effect.Effect<void, PlatformError | EmptyCommitError, CommandExecutor> =
  Effect.gen(function* () {
    const status = yield* gitStatusPorcelain();
    if (status === "") {
      // 差分がまったくない場合はエラー。
      return yield* new EmptyCommitError({ message: "No changes to commit." });
    }
    if (!hasStagedChanges(status)) {
      // 変更があるのにステージされていない場合は全てステージする。
      yield* gitAddAll();
    }
  });

/**
 * Gitの前処理を行って、
 * 差分内容をpatchファイルとして書き込み、
 * そのファイルパスを返します。
 */
export function writePatch(
  workdirPath: string,
): Effect.Effect<
  string,
  EmptyCommitError | PlatformError,
  CommandExecutor | FileSystem.FileSystem | Path.Path
> {
  return Effect.gen(function* () {
    yield* ensureStaged;
    const diff = yield* gitDiffForCommit();
    if (diff === "") {
      return yield* new EmptyCommitError({ message: "No staged changes to commit." });
    }
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const patchPath = path.join(workdirPath, "git-diff-for-commit.patch");
    yield* fs.writeFileString(patchPath, diff);
    return patchPath;
  });
}
