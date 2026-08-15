import { chdir, cwd } from "node:process";
import { Command, FileSystem, Path, Terminal } from "@effect/platform";
import type { CommandExecutor } from "@effect/platform/CommandExecutor";
import type { PlatformError } from "@effect/platform/Error";
import { NodeContext } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { Cause, Effect, Exit, Layer, Option, Scope } from "effect";
import { afterEach, assert, describe, expect } from "vitest";
import { CommitMsgHookFailedError, runCommitMsgHook } from "../src/run-commit-msg-hook";

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
 * スコープに紐づく一時ディレクトリにGitリポジトリを初期化して、
 * フックディレクトリを専用の一時ディレクトリに向けたリポジトリのパスを返します。
 *
 * `core.hooksPath`をリポジトリごとに設定するのは、
 * ユーザのグローバル設定のフックがテストへ紛れ込まないようにするためです。
 */
const initRepo: Effect.Effect<
  { readonly repo: string; readonly hooks: string },
  PlatformError,
  FileSystem.FileSystem | Path.Path | CommandExecutor | Scope.Scope
> = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repo = yield* fs.makeTempDirectoryScoped();
  const hooks = path.join(repo, "git-hooks");
  yield* fs.makeDirectory(hooks);
  yield* Command.make("git", "init", "--quiet").pipe(
    Command.workingDirectory(repo),
    Command.exitCode,
  );
  yield* Command.make("git", "config", "core.hooksPath", hooks).pipe(
    Command.workingDirectory(repo),
    Command.exitCode,
  );
  return { repo, hooks };
});

/**
 * `commit-msg`フックを指定した内容で実行可能な状態に書き出します。
 */
function writeCommitMsgHook(
  hooks: string,
  script: string,
): Effect.Effect<string, PlatformError, FileSystem.FileSystem | Path.Path> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const hookPath = path.join(hooks, "commit-msg");
    yield* fs.writeFileString(hookPath, script);
    yield* fs.chmod(hookPath, 0o755);
    return hookPath;
  });
}

/**
 * 検査対象のコミットメッセージファイルを書き出してそのパスを返します。
 */
function writeMessage(
  repo: string,
  message: string,
): Effect.Effect<string, PlatformError, FileSystem.FileSystem | Path.Path> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const messagePath = path.join(repo, "COMMIT_EDITMSG");
    yield* fs.writeFileString(messagePath, message);
    return messagePath;
  });
}

describe("runCommitMsgHook", () => {
  const originalCwd = cwd();
  afterEach(() => {
    // gitのコマンドはcwdのリポジトリを見るため、テストごとにcwdを戻します。
    chdir(originalCwd);
  });

  it.scoped("フックが設定されていなければ検査をスキップして成功する", () =>
    Effect.gen(function* () {
      const { repo } = yield* initRepo;
      const messagePath = yield* writeMessage(repo, "feat: 新機能を追加します\n");
      chdir(repo);
      const output: string[] = [];
      yield* runCommitMsgHook(messagePath).pipe(Effect.provide(captureTerminal(output)));
      expect(output.join("")).toContain("Skipped");
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("フックが成功すればそのまま成功する", () =>
    Effect.gen(function* () {
      const { repo, hooks } = yield* initRepo;
      const hookPath = yield* writeCommitMsgHook(hooks, "#!/bin/sh\nexit 0\n");
      const messagePath = yield* writeMessage(repo, "feat: 新機能を追加します\n");
      chdir(repo);
      const output: string[] = [];
      yield* runCommitMsgHook(messagePath).pipe(Effect.provide(captureTerminal(output)));
      expect(output.join("")).toContain(hookPath);
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("フックが非0で終わると終了コードを含むエラーで失敗する", () =>
    Effect.gen(function* () {
      const { repo, hooks } = yield* initRepo;
      const hookPath = yield* writeCommitMsgHook(hooks, "#!/bin/sh\nexit 3\n");
      const messagePath = yield* writeMessage(repo, "壊れたメッセージ\n");
      chdir(repo);
      const output: string[] = [];
      const exit = yield* Effect.exit(
        runCommitMsgHook(messagePath).pipe(Effect.provide(captureTerminal(output))),
      );
      assert(Exit.isFailure(exit));
      const failure = Cause.failureOption(exit.cause);
      assert(Option.isSome(failure));
      assert(failure.value instanceof CommitMsgHookFailedError);
      expect(failure.value.exitCode).toBe(3);
      expect(failure.value.hookPath).toBe(hookPath);
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("メッセージファイルのパスを第一引数として渡す", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { repo, hooks } = yield* initRepo;
      yield* writeCommitMsgHook(hooks, '#!/bin/sh\nprintf %s "$1" > "$(dirname "$1")/argv1"\n');
      const messagePath = yield* writeMessage(repo, "feat: 新機能を追加します\n");
      chdir(repo);
      const output: string[] = [];
      yield* runCommitMsgHook(messagePath).pipe(Effect.provide(captureTerminal(output)));
      expect(yield* fs.readFileString(path.join(repo, "argv1"))).toBe(messagePath);
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("フックによるメッセージファイルの書き換えをgitと同じくそのまま採用する", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { repo, hooks } = yield* initRepo;
      yield* writeCommitMsgHook(hooks, '#!/bin/sh\nprintf "書き換えました\\n" > "$1"\n');
      const messagePath = yield* writeMessage(repo, "feat: 新機能を追加します\n");
      chdir(repo);
      const output: string[] = [];
      yield* runCommitMsgHook(messagePath).pipe(Effect.provide(captureTerminal(output)));
      expect(yield* fs.readFileString(messagePath)).toBe("書き換えました\n");
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("リポジトリのルートを作業ディレクトリとしてフックを実行する", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { repo, hooks } = yield* initRepo;
      yield* writeCommitMsgHook(hooks, '#!/bin/sh\npwd -P > "$(dirname "$1")/pwd"\n');
      const messagePath = yield* writeMessage(repo, "feat: 新機能を追加します\n");
      // リポジトリのサブディレクトリから実行してもルートで動くことを確認します。
      const sub = path.join(repo, "sub");
      yield* fs.makeDirectory(sub);
      chdir(sub);
      const output: string[] = [];
      yield* runCommitMsgHook(messagePath).pipe(Effect.provide(captureTerminal(output)));
      const actual = (yield* fs.readFileString(path.join(repo, "pwd"))).trimEnd();
      expect(actual).toBe(yield* fs.realPath(repo));
    }).pipe(Effect.provide(NodeContext.layer)),
  );
});
