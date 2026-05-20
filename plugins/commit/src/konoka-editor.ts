import { Command, FileSystem } from "@effect/platform";
import type { CommandExecutor } from "@effect/platform/CommandExecutor";
import type { PlatformError } from "@effect/platform/Error";
import { Data, Effect } from "effect";
import { appendDiffToEditmsg, removeDiffFromEditmsg } from "./attach-diff";
import { getEditor } from "./get-editor";

export class EditorFailedError extends Data.TaggedError("EditorFailedError")<{
  readonly editor: Command.Command;
  readonly exitCode: number;
}> {
  override get message(): string {
    return `Editor command "${String(this.editor)}" failed with exit code ${this.exitCode}.`;
  }
}

/**
 * コマンドを推定して起動して編集を行います。
 *
 * diffの付与をacquire、取り除きをreleaseとして`Effect.acquireUseRelease`に対応付けます。
 * これにより、エディタの起動が失敗したり中断されたりして途中でエラーになっても、
 * 一度付与したdiffは確実に取り除かれ、ファイルにdiffが残りません。
 */
export function konokaEdit(
  commitEditmsgPath: string,
  patchPath: string,
): Effect.Effect<void, PlatformError | EditorFailedError, CommandExecutor | FileSystem.FileSystem> {
  return Effect.gen(function* () {
    const editor = yield* getEditor(commitEditmsgPath);
    yield* Effect.acquireUseRelease(
      appendDiffToEditmsg(commitEditmsgPath, patchPath),
      () =>
        Effect.gen(function* () {
          const code = yield* Command.exitCode(editor); // テキストエディタが実際に起動します。
          if (code !== 0) {
            return yield* new EditorFailedError({ editor, exitCode: code });
          }
        }),
      // diffの取り除きは必ず実行したいので、失敗した場合はdefectとして表面化させます。
      () => Effect.orDie(removeDiffFromEditmsg(commitEditmsgPath)),
    );
  });
}
