import { Command, FileSystem, Path } from "@effect/platform";
import type { CommandExecutor } from "@effect/platform/CommandExecutor";
import type { PlatformError } from "@effect/platform/Error";
import { Data, Effect, Option } from "effect";

/** Raised when a git command outputs nothing, which means it did not answer the question. */
export class GitCommandFailedError extends Data.TaggedError("GitCommandFailedError")<{
  readonly args: readonly string[];
}> {
  override get message(): string {
    const command = ["git", ...this.args].join(" ");
    return `The command "${command}" output nothing. Is the working directory inside a repository?`;
  }
}

/**
 * gitコマンドを指定された引数で実行し、
 * 標準出力をトリムして返します。
 *
 * ここで使うのはパスを問い合わせるコマンドだけなので、
 * 出力が空になるのは失敗したときだけです。
 * 空の出力を成功として扱うと検査を黙って飛ばすことになるため、
 * エラーとして扱います。
 * gitが出す原因のメッセージはそのまま見えるように標準エラー出力を引き継ぎます。
 */
function git(
  ...args: readonly string[]
): Effect.Effect<string, PlatformError | GitCommandFailedError, CommandExecutor> {
  return Command.make("git", ...args).pipe(
    Command.stderr("inherit"),
    Command.string,
    Effect.map((output) => output.trimEnd()),
    Effect.flatMap((output) =>
      output === "" ? new GitCommandFailedError({ args }) : Effect.succeed(output),
    ),
  );
}

/**
 * 作業中のリポジトリのルートディレクトリを返します。
 *
 * gitはフックをリポジトリのルートで実行するため、
 * フックの実行時の作業ディレクトリとして使います。
 */
export const gitTopLevel: Effect.Effect<
  string,
  PlatformError | GitCommandFailedError,
  CommandExecutor
> = git("rev-parse", "--show-toplevel");

/**
 * gitが実際に参照するフックディレクトリの絶対パスを返します。
 *
 * `core.hooksPath`が設定されていればその値が返るため、
 * グローバル設定のフックも作業中のリポジトリのフックも同じ方法で辿れます。
 * 作業ディレクトリがリポジトリのサブディレクトリでも絶対パスを得たいので、
 * `--path-format=absolute`を指定します。
 */
export const gitHooksPath: Effect.Effect<
  string,
  PlatformError | GitCommandFailedError,
  CommandExecutor
> = git("rev-parse", "--path-format=absolute", "--git-path", "hooks");

/**
 * ファイル情報が実行可能なファイルのものかを判定します。
 *
 * gitは実行可能でないフックを警告した上で無視するため、
 * この判定に合わないものはフックが無いものとして扱います。
 */
export function isExecutableFile(info: FileSystem.File.Info): boolean {
  return info.type === "File" && (info.mode & 0o111) !== 0;
}

/**
 * 指定した名前のgitフックが実行可能な状態で存在すればそのパスを返します。
 *
 * フックが存在しない場合や実行可能でない場合は`Option.none`を返します。
 */
export function findGitHook(
  hookName: string,
): Effect.Effect<
  Option.Option<string>,
  PlatformError | GitCommandFailedError,
  CommandExecutor | FileSystem.FileSystem | Path.Path
> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const hookPath = path.join(yield* gitHooksPath, hookName);
    const info = yield* fs.stat(hookPath).pipe(
      Effect.map(Option.some),
      Effect.catchTag("SystemError", (err) =>
        err.reason === "NotFound"
          ? Effect.succeed(Option.none<FileSystem.File.Info>())
          : Effect.fail(err),
      ),
    );
    return Option.filter(info, isExecutableFile).pipe(Option.as(hookPath));
  });
}
