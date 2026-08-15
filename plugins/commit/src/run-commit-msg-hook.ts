import { Command, FileSystem, Path, Terminal } from "@effect/platform";
import type { CommandExecutor } from "@effect/platform/CommandExecutor";
import type { PlatformError } from "@effect/platform/Error";
import { Data, Effect, Option } from "effect";
import type { GitCommandFailedError } from "./find-git-hook";
import { findGitHook, gitTopLevel } from "./find-git-hook";

/**
 * コミットメッセージを検査するgitフックの名前です。
 */
export const commitMsgHookName = "commit-msg" as const;

/** Raised when the commit-msg hook rejects the message. */
export class CommitMsgHookFailedError extends Data.TaggedError("CommitMsgHookFailedError")<{
  readonly hookPath: string;
  readonly exitCode: number;
}> {
  override get message(): string {
    const reason = `rejected the message with exit code ${this.exitCode}`;
    return `The ${commitMsgHookName} hook "${this.hookPath}" ${reason}.`;
  }
}

/**
 * 設定されている`commit-msg`フックでメッセージファイルを検査します。
 *
 * gitが`git commit`のときに行う起動方法を再現します。
 * リポジトリのルートを作業ディレクトリにして、
 * メッセージファイルのパスを第一引数として渡します。
 * フックがメッセージファイルを書き換える場合もgitと同じくその結果をそのまま採用するので、
 * 呼び出し側は実行後にファイルを読み直してください。
 *
 * フックの標準出力と標準エラー出力はそのまま引き継いで表示します。
 * リンタの指摘内容を呼び出し側がそのまま読めるようにするためです。
 *
 * フックが設定されていない場合は検査をスキップして成功します。
 */
export function runCommitMsgHook(
  messagePath: string,
): Effect.Effect<
  void,
  PlatformError | GitCommandFailedError | CommitMsgHookFailedError,
  CommandExecutor | FileSystem.FileSystem | Path.Path | Terminal.Terminal
> {
  return Effect.gen(function* () {
    const path = yield* Path.Path;
    const terminal = yield* Terminal.Terminal;
    const hookPath = yield* findGitHook(commitMsgHookName);
    if (Option.isNone(hookPath)) {
      yield* terminal.display(
        `No executable ${commitMsgHookName} hook is configured. Skipped the check.\n`,
      );
      return;
    }
    const workingDirectory = yield* gitTopLevel;
    const hook = Command.make(hookPath.value, path.resolve(messagePath)).pipe(
      Command.workingDirectory(workingDirectory),
      // gitはフックの標準入力を空にするため、即座にEOFになる入力を与えて同じ状態にします。
      Command.feed(""),
      Command.stdout("inherit"),
      Command.stderr("inherit"),
    );
    const exitCode = yield* Command.exitCode(hook);
    if (exitCode !== 0) {
      return yield* new CommitMsgHookFailedError({ hookPath: hookPath.value, exitCode });
    }
    yield* terminal.display(`The ${commitMsgHookName} hook "${hookPath.value}" passed.\n`);
  });
}
