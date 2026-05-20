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
 */
export function konokaEdit(
  commitEditmsgPath: string,
  patchPath: string,
): Effect.Effect<void, PlatformError | EditorFailedError, CommandExecutor | FileSystem.FileSystem> {
  return Effect.gen(function* () {
    const editor = yield* getEditor(commitEditmsgPath);
    yield* appendDiffToEditmsg(commitEditmsgPath, patchPath);
    const code = yield* Command.exitCode(editor); // テキストエディタが実際に起動します。
    yield* removeDiffFromEditmsg(commitEditmsgPath);
    if (code !== 0) {
      yield* new EditorFailedError({ editor, exitCode: code });
    }
  });
}
