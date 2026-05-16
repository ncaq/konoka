import { NodeContext } from "@effect/platform-node";
import { describe, it } from "@effect/vitest";
import { Cause, ConfigProvider, Effect, Exit, Option } from "effect";
import { expect, test } from "vitest";
import {
  buildEditorInvocation,
  defaultEditor,
  editorCommand,
  konokaEdit,
} from "../src/konoka-editor";

describe("buildEditorInvocation", () => {
  test("`sh -c`経由のargvを生成する", () => {
    expect(buildEditorInvocation("vim", "/tmp/file")).toEqual([
      "sh",
      "-c",
      `vim "$@"`,
      "konoka-editor",
      "/tmp/file",
    ]);
  });

  test("引数付きエディタ指定もそのままシェルスクリプトに埋め込む", () => {
    expect(buildEditorInvocation("emacsclient --reuse-frame", "/tmp/file")).toEqual([
      "sh",
      "-c",
      `emacsclient --reuse-frame "$@"`,
      "konoka-editor",
      "/tmp/file",
    ]);
  });

  test("ファイルパスをスクリプト本体に埋め込まず位置引数として渡す", () => {
    const argv = buildEditorInvocation("vim", "/tmp/file with space");
    expect(argv[2]).toBe(`vim "$@"`);
    expect(argv[2]).not.toContain("/tmp/file with space");
    expect(argv[4]).toBe("/tmp/file with space");
  });

  test("シェル内`$0`にあたる位置に`konoka-editor`を渡す", () => {
    const argv = buildEditorInvocation("vim", "/tmp/file");
    expect(argv[3]).toBe("konoka-editor");
  });

  test("実行ファイルパスをクオートしたエディタ指定もそのまま渡す", () => {
    const editor = `"/Applications/Visual Studio Code.app/Contents/MacOS/Electron" --wait`;
    expect(buildEditorInvocation(editor, "/tmp/file")).toEqual([
      "sh",
      "-c",
      `${editor} "$@"`,
      "konoka-editor",
      "/tmp/file",
    ]);
  });
});

describe("editorCommand", () => {
  it.effect("`EDITOR`が設定されていればその値を返す", () =>
    editorCommand.pipe(
      Effect.tap((cmd) => {
        expect(cmd).toBe("nano");
      }),
      Effect.withConfigProvider(ConfigProvider.fromMap(new Map([["EDITOR", "nano"]]))),
    ),
  );

  it.effect("`EDITOR`に引数付きコマンドを設定してもそのまま返す", () =>
    editorCommand.pipe(
      Effect.tap((cmd) => {
        expect(cmd).toBe("code --wait");
      }),
      Effect.withConfigProvider(ConfigProvider.fromMap(new Map([["EDITOR", "code --wait"]]))),
    ),
  );

  it.effect("`EDITOR`が未設定の場合はデフォルトを返す", () =>
    editorCommand.pipe(
      Effect.tap((cmd) => {
        expect(cmd).toBe(defaultEditor);
      }),
      Effect.withConfigProvider(ConfigProvider.fromMap(new Map())),
    ),
  );

  it.effect("`EDITOR`が空文字列の場合もデフォルトを返す", () =>
    editorCommand.pipe(
      Effect.tap((cmd) => {
        expect(cmd).toBe(defaultEditor);
      }),
      Effect.withConfigProvider(ConfigProvider.fromMap(new Map([["EDITOR", ""]]))),
    ),
  );
});

describe("konokaEdit", () => {
  it.effect("`EDITOR`が0で終わる場合は成功する", () =>
    konokaEdit("/tmp/konoka-editor-test-arg").pipe(
      Effect.withConfigProvider(ConfigProvider.fromMap(new Map([["EDITOR", "true"]]))),
      Effect.provide(NodeContext.layer),
    ),
  );

  it.effect("`EDITOR`が非0で終わる場合は終了コードを含むdefectで死ぬ", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(konokaEdit("/tmp/konoka-editor-test-arg"));
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const defect = Cause.dieOption(exit.cause);
        expect(Option.isSome(defect)).toBe(true);
        if (Option.isSome(defect)) {
          expect(String(defect.value)).toContain(`Editor "false" failed (status 1)`);
        }
      }
    }).pipe(
      Effect.withConfigProvider(ConfigProvider.fromMap(new Map([["EDITOR", "false"]]))),
      Effect.provide(NodeContext.layer),
    ),
  );

  it.effect("引数のファイルパスが`$1`としてエディタに渡る", () => {
    // 内側に`sh -c`をもう一段噛ませることで、`"$@"`を素直な位置引数として受け取り、
    // `$1`が`konokaEdit`に渡したファイルパスと一致するかを終了コードで判定します。
    const arg = "/tmp/konoka-editor-passthrough-test";
    const editor = `sh -c 'test "$1" = "${arg}"' --`;
    return konokaEdit(arg).pipe(
      Effect.withConfigProvider(ConfigProvider.fromMap(new Map([["EDITOR", editor]]))),
      Effect.provide(NodeContext.layer),
    );
  });
});
