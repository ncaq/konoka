import process from "node:process";
import { FileSystem, Path, Terminal } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { NodeContext } from "@effect/platform-node";
import { it } from "@effect/vitest";
import type { Scope } from "effect";
import { ConfigProvider, Effect, Layer } from "effect";
import { afterEach, describe, expect } from "vitest";
import { defaultWidth, showStagedPatch } from "../src/show-staged-patch";

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

/**
 * スコープに紐づく一時ディレクトリにパッチファイルを書き出してそのパスを返します。
 */
function writePatchFile(
  content: string,
): Effect.Effect<string, PlatformError, FileSystem.FileSystem | Path.Path | Scope.Scope> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const dir = yield* fs.makeTempDirectoryScoped();
    const patchPath = path.join(dir, "git-diff-for-commit.patch");
    yield* fs.writeFileString(patchPath, content);
    return patchPath;
  });
}

/**
 * スコープに紐づく一時ディレクトリに指定した内容のスタブ`delta`を実行可能な状態で書き出して、
 * そのディレクトリのパスを返します。
 * 返り値を`PATH`の先頭に加えることで本物のdeltaの代わりに呼ばせます。
 */
function makeStubDeltaDir(
  script: string,
): Effect.Effect<string, PlatformError, FileSystem.FileSystem | Path.Path | Scope.Scope> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const dir = yield* fs.makeTempDirectoryScoped();
    const stubPath = path.join(dir, "delta");
    yield* fs.writeFileString(stubPath, script);
    yield* fs.chmod(stubPath, 0o755);
    return dir;
  });
}

/**
 * `COLUMNS`を含む環境変数を空にした設定でEffectを実行します。
 * 実行環境の`COLUMNS`がテスト結果へ紛れ込まないようにするためです。
 */
const emptyConfig = ConfigProvider.fromMap(new Map());

describe("showStagedPatch", () => {
  const originalPath = process.env["PATH"];
  afterEach(() => {
    // deltaの解決はスタブを`PATH`へ差し込んで制御するため、テストごとに`PATH`を戻します。
    if (originalPath == null) {
      delete process.env["PATH"];
    } else {
      process.env["PATH"] = originalPath;
    }
  });

  it.scoped("deltaが使えるときはパッチをstdinで渡してその出力を表示する", () =>
    Effect.gen(function* () {
      const patch = "diff --git a/x.ts b/x.ts\n+added\n";
      const patchPath = yield* writePatchFile(patch);
      const stubDir = yield* makeStubDeltaDir("#!/bin/sh\nprintf 'HIGHLIGHTED:'\ncat\n");
      process.env["PATH"] = `${stubDir}:${originalPath ?? ""}`;
      const output: string[] = [];
      yield* showStagedPatch(patchPath).pipe(
        Effect.provide(captureTerminal(output)),
        Effect.withConfigProvider(emptyConfig),
      );
      expect(output.join("")).toBe(`HIGHLIGHTED:${patch}`);
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("deltaが見つからないときは素のパッチをそのまま表示する", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const patch = "diff --git a/x.ts b/x.ts\n+added\n";
      const patchPath = yield* writePatchFile(patch);
      // 空のディレクトリだけをPATHにしてdeltaを見つからなくします。
      process.env["PATH"] = yield* fs.makeTempDirectoryScoped();
      const output: string[] = [];
      yield* showStagedPatch(patchPath).pipe(
        Effect.provide(captureTerminal(output)),
        Effect.withConfigProvider(emptyConfig),
      );
      expect(output.join("")).toBe(patch);
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("deltaが非0で終わるときは素のパッチをそのまま表示する", () =>
    Effect.gen(function* () {
      const patch = "diff --git a/x.ts b/x.ts\n+added\n";
      const patchPath = yield* writePatchFile(patch);
      const stubDir = yield* makeStubDeltaDir("#!/bin/sh\ncat > /dev/null\nexit 1\n");
      process.env["PATH"] = `${stubDir}:${originalPath ?? ""}`;
      const output: string[] = [];
      yield* showStagedPatch(patchPath).pipe(
        Effect.provide(captureTerminal(output)),
        Effect.withConfigProvider(emptyConfig),
      );
      expect(output.join("")).toBe(patch);
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("コードフェンス記号を含むパッチもフォールバックで無加工のまま全文表示する", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      // 旧実装はLLMがdiffコードフェンスで再出力していたため、
      // パッチ内のコードフェンス記号で表示が壊れていました。
      // その解消をテストとして固定化します。
      const patch = 'diff --git a/x.md b/x.md\n+```bash\n+echo "hello"\n+```\n';
      const patchPath = yield* writePatchFile(patch);
      process.env["PATH"] = yield* fs.makeTempDirectoryScoped();
      const output: string[] = [];
      yield* showStagedPatch(patchPath).pipe(
        Effect.provide(captureTerminal(output)),
        Effect.withConfigProvider(emptyConfig),
      );
      expect(output.join("")).toBe(patch);
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("環境変数COLUMNSの値が`--width`としてdeltaに渡る", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const patchPath = yield* writePatchFile("diff --git a/x.ts b/x.ts\n+added\n");
      const argsDir = yield* fs.makeTempDirectoryScoped();
      const argsPath = path.join(argsDir, "args");
      const stubDir = yield* makeStubDeltaDir(
        `#!/bin/sh\nprintf '%s\\n' "$@" > "${argsPath}"\ncat > /dev/null\n`,
      );
      process.env["PATH"] = `${stubDir}:${originalPath ?? ""}`;
      const output: string[] = [];
      yield* showStagedPatch(patchPath).pipe(
        Effect.provide(captureTerminal(output)),
        Effect.withConfigProvider(ConfigProvider.fromMap(new Map([["COLUMNS", "123"]]))),
      );
      expect(yield* fs.readFileString(argsPath)).toBe("--paging=never\n--width=123\n");
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("COLUMNSが未設定なら既定の幅が`--width`としてdeltaに渡る", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const patchPath = yield* writePatchFile("diff --git a/x.ts b/x.ts\n+added\n");
      const argsDir = yield* fs.makeTempDirectoryScoped();
      const argsPath = path.join(argsDir, "args");
      const stubDir = yield* makeStubDeltaDir(
        `#!/bin/sh\nprintf '%s\\n' "$@" > "${argsPath}"\ncat > /dev/null\n`,
      );
      process.env["PATH"] = `${stubDir}:${originalPath ?? ""}`;
      const output: string[] = [];
      yield* showStagedPatch(patchPath).pipe(
        Effect.provide(captureTerminal(output)),
        Effect.withConfigProvider(emptyConfig),
      );
      expect(yield* fs.readFileString(argsPath)).toBe(`--paging=never\n--width=${defaultWidth}\n`);
    }).pipe(Effect.provide(NodeContext.layer)),
  );
});
