import { cwd, chdir } from "node:process";
import { Command, FileSystem, Path, Terminal } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { afterEach, assert, describe, expect } from "vitest";
import { prepareCommit } from "../src/commit-prepare";

/**
 * `Terminal.display`に渡された文字列を`sink`に蓄積するテスト用のTerminal層です。
 * 標準出力へ実際に書き出す代わりに出力内容を検査できるようにします。
 */
function captureTerminal(sink: string[]): Layer.Layer<Terminal.Terminal> {
  return Layer.succeed(Terminal.Terminal, {
    columns: Effect.succeed(80),
    rows: Effect.succeed(24),
    isTTY: Effect.succeed(false),
    readInput: Effect.dieMessage("readInput is not used in this test"),
    readLine: Effect.dieMessage("readLine is not used in this test"),
    display: (input) =>
      Effect.sync(() => {
        sink.push(input);
      }),
  });
}

describe("prepareCommit", () => {
  const originalCwd = cwd();
  afterEach(() => {
    // prepareCommitはcwdのGitリポジトリを操作するため、テストごとにcwdを戻します。
    chdir(originalCwd);
  });

  it.scoped("editmsgPathとpatchPathのJSONを標準出力へ出力する", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      // 変更のあるGitリポジトリを用意します。
      const repo = yield* fs.makeTempDirectoryScoped();
      yield* Command.make("git", "init", "--quiet").pipe(
        Command.workingDirectory(repo),
        Command.exitCode,
      );
      yield* fs.writeFileString(path.join(repo, "a.txt"), "hello\n");
      chdir(repo);

      const output: string[] = [];
      yield* prepareCommit.pipe(Effect.provide(captureTerminal(output)));
      // displayが1回呼ばれ、末尾改行付きのJSONが出力されていることを確認します。
      expect(output).toHaveLength(1);
      assert(output[0] !== undefined);
      expect(output[0].endsWith("\n")).toBe(true);
      const report: unknown = JSON.parse(output[0]);
      assert(typeof report === "object" && report !== null);
      assert("editmsgPath" in report && "patchPath" in report);
      const { editmsgPath, patchPath } = report;
      assert(typeof editmsgPath === "string" && typeof patchPath === "string");
      expect(editmsgPath).toContain("COMMIT_EDITMSG");
      expect(patchPath).toContain("git-diff-for-commit.patch");
      // editmsgPathはパスを返すだけでファイルは生成しないことを確認します。
      // 空ファイルを作るとAIが`Write`ツールで書き込む前に読み込みを強いられて無駄になるためです。
      expect(yield* fs.exists(editmsgPath)).toBe(false);
      // patchPathのファイルは実際に生成されていることを確認します。
      expect(yield* fs.exists(patchPath)).toBe(true);
    }).pipe(Effect.provide(NodeContext.layer)),
  );
});
