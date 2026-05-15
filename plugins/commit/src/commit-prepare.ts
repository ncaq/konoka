import { tmpdir } from "node:os";
import { Command, FileSystem, Path } from "@effect/platform";
import type { CommandExecutor } from "@effect/platform/CommandExecutor";
import type { PlatformError } from "@effect/platform/Error";
import { Config, Data, Effect } from "effect";

const pluginName = "commit" as const;

/** Raised when there is nothing to commit. */
export class EmptyCommitError extends Data.TaggedError("EmptyCommitError")<{
  readonly message: string;
}> {}

/** Generate an ISO 8601-like timestamp for use in directory names. */
export function timestamp(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  return `${date}T${time}`;
}

/** Check whether git status --porcelain output contains staged entries. */
export function hasStagedChanges(status: string): boolean {
  return status.split("\n").some((line) => {
    const index = line[0];
    return index != null && index !== " " && index !== "?";
  });
}

/** Build a COMMIT_EDITMSG template string with scissors line and diff. */
export function buildEditmsgTemplate(diff: string): string {
  return `\n# ------------------------ >8 ------------------------\n${diff}\n`;
}

/** Run git with the given args and return trimmed stdout. */
function git(...args: readonly string[]): Effect.Effect<string, PlatformError, CommandExecutor> {
  return Command.string(Command.make("git", ...args)).pipe(Effect.map((s) => s.trimEnd()));
}

const personalWorkDir: Effect.Effect<string> = Config.nonEmptyString("XDG_RUNTIME_DIR").pipe(
  Effect.orElseSucceed(() => tmpdir()),
);

const codingAgentWorkDir: Effect.Effect<string, never, Path.Path> = Effect.gen(function* () {
  const path = yield* Path.Path;
  const base = yield* personalWorkDir;
  return path.join(base, "coding-agent-work", pluginName);
});

const createWorkdirPath: Effect.Effect<string, PlatformError, FileSystem.FileSystem | Path.Path> =
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const base = yield* codingAgentWorkDir;
    yield* fs.makeDirectory(base, { recursive: true, mode: 0o700 });
    return yield* fs.makeTempDirectory({ directory: base, prefix: `${timestamp()}-` });
  });

const ensureStaged: Effect.Effect<void, PlatformError | EmptyCommitError, CommandExecutor> =
  Effect.gen(function* () {
    const status = yield* git("status", "--porcelain");
    if (status === "") {
      return yield* new EmptyCommitError({ message: "No changes to commit." });
    }
    if (!hasStagedChanges(status)) {
      yield* git("add", "--all");
    }
  });

const getStagedDiff: Effect.Effect<string, PlatformError | EmptyCommitError, CommandExecutor> =
  Effect.gen(function* () {
    const diff = yield* git("diff", "--cached");
    if (diff === "") {
      return yield* new EmptyCommitError({ message: "No staged changes to commit." });
    }
    return diff;
  });

const stageThenDiff: Effect.Effect<string, PlatformError | EmptyCommitError, CommandExecutor> =
  ensureStaged.pipe(Effect.zipRight(getStagedDiff));

function writeEditmsgTemplate(
  workdirPath: string,
  diff: string,
): Effect.Effect<string, PlatformError, FileSystem.FileSystem | Path.Path> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const editmsgPath = path.join(workdirPath, "COMMIT_EDITMSG");
    yield* fs.writeFileString(editmsgPath, buildEditmsgTemplate(diff));
    return editmsgPath;
  });
}

/**
 * ステージ済みの変更を確保し、`COMMIT_EDITMSG`テンプレートを書き出して、
 * その絶対パスを返します。
 *
 * `$XDG_RUNTIME_DIR/coding-agent-work/commit/`配下にタイムスタンプ付きの
 * 一時ディレクトリを作り、scissors lineと差分を含むテンプレートを配置します。
 * 未設定環境では`os.tmpdir()`にフォールバックします。
 *
 * 何もステージできるものが無い場合は`EmptyCommitError`で失敗します。
 */
export const prepareCommit: Effect.Effect<
  string,
  PlatformError | EmptyCommitError,
  FileSystem.FileSystem | Path.Path | CommandExecutor
> = Effect.gen(function* () {
  const [workdirPath, diff] = yield* Effect.all([createWorkdirPath, stageThenDiff], {
    concurrency: 2,
  });
  return yield* writeEditmsgTemplate(workdirPath, diff);
});
