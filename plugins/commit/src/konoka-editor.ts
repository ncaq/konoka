import { Command } from "@effect/platform";
import type { CommandExecutor } from "@effect/platform/CommandExecutor";
import type { PlatformError } from "@effect/platform/Error";
import { Config, Data, Effect } from "effect";

export class EditorFailedError extends Data.TaggedError("EditorFailedError")<{
  readonly editor: string;
  readonly exitCode: number;
}> {
  override get message(): string {
    return `Editor command "${this.editor}" failed with exit code ${this.exitCode}.`;
  }
}

/**
 * 環境変数`EDITOR`が未設定または空のときに使うデフォルトのエディタコマンドです。
 */
export const defaultEditor = "emacsclient --reuse-frame --alternate-editor=emacs" as const;

/**
 * 環境変数`EDITOR`の値を取得し、
 * 未設定または空文字列の場合は`defaultEditor`を返します。
 *
 * `EDITOR`はユーザが設定するものなので信頼できる文字列として扱います。
 * シェルが解釈するコマンド文字列としてそのまま`sh -c`に渡される前提です。
 */
export const editorCommand: Effect.Effect<string> = Config.nonEmptyString("EDITOR").pipe(
  Effect.orElseSucceed(() => defaultEditor),
);

/**
 * `EDITOR`コマンド文字列とファイルパスから、
 * `sh -c`経由で起動するための`argv`を生成します。
 *
 * gitやsudoeditと同じく、
 * `EDITOR`はシェルが解釈するコマンド文字列として扱います。
 * 実行ファイルパスにスペースがある場合はユーザがクオートで対処します。
 * ファイルパスは`"$@"`経由の位置引数として渡し、
 * シェル側での再解釈を避けます。
 */
export function buildEditorInvocation(
  editor: string,
  file: string,
): readonly ["sh", "-c", string, "konoka-editor", string] {
  return [
    "sh",
    "-c",
    `${editor} "$@"`,
    // `sh -c <script> <argv0> <argv1>...`の引数列で、
    // `<argv0>`はスクリプト内の`$0`に入ります。
    // シェルがエラーメッセージを出す際の名乗りに使われるので、ここを`konoka-editor`にしておくと、
    // `konoka-editor: <editor>: not found`のように出所の追跡しやすい表示になります。
    "konoka-editor",
    file,
  ];
}

/**
 * コマンドを推定して起動して編集を行います。
 */
export function konokaEdit(
  commitEditmsgArg: string,
): Effect.Effect<void, PlatformError, CommandExecutor> {
  return Effect.gen(function* () {
    const editor = yield* editorCommand;
    const [executable, ...args] = buildEditorInvocation(editor, commitEditmsgArg);
    const cmd = Command.make(executable, ...args).pipe(
      Command.stdin("inherit"),
      Command.stdout("inherit"),
      Command.stderr("inherit"),
    );
    yield* Command.exitCode(cmd).pipe(
      Effect.filterOrDie(
        (code) => code === 0,
        (code) => new EditorFailedError({ editor, exitCode: code }),
      ),
    );
  });
}
