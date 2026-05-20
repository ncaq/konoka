import { tmpdir } from "node:os";
import { FileSystem, Path } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { Config, Effect } from "effect";

const pluginName = "commit" as const;

/**
 * ISO 8601風のtimestampでディレクトリ名などに使えそうな文字列を生成します。
 */
export function timestamp(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  return `${date}T${time}`;
}

/**
 * 一時作業ディレクトリのベースパスを取得します。
 * 環境変数`XDG_RUNTIME_DIR`が設定されていればその値を、
 * そうでなければOSの一時ディレクトリを返します。
 */
const personalWorkDir: Effect.Effect<string> = Config.nonEmptyString("XDG_RUNTIME_DIR").pipe(
  Effect.orElseSucceed(() => tmpdir()),
);

/**
 * コーディングエージェントが自由に使える一時作業ディレクトリのベースパスを生成します。
 */
const codingAgentWorkDir: Effect.Effect<string, never, Path.Path> = Effect.gen(function* () {
  const path = yield* Path.Path;
  const base = yield* personalWorkDir;
  return path.join(base, "coding-agent-work", pluginName);
});

/**
 * commitプラグインが使えそうな一時作業ディレクトリを生成してそのパスを返します。
 */
export const createWorkdirPath: Effect.Effect<
  string,
  PlatformError,
  FileSystem.FileSystem | Path.Path
> = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const base = yield* codingAgentWorkDir;
  yield* fs.makeDirectory(base, { recursive: true, mode: 0o700 });
  return yield* fs.makeTempDirectory({ directory: base, prefix: `${timestamp()}-` });
});
