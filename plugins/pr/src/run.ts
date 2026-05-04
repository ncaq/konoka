import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

/**
 * 子プロセス実行絡みのエラーを表す共通の例外型。
 * `stderr`は子プロセスからの標準エラー出力をそのまま保持しますが、
 * ロジック由来で投げる場合は空文字列で構いません。
 */
export class CommandError extends Error {
  public readonly stderr: string;

  public constructor(message: string, stderr: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CommandError";
    this.stderr = stderr;
  }
}

/**
 * `CommandError`を投げるべき状況ならそれを投げ、
 * そうでないなら普通に例外を再スローします。
 */
export function throwCommandError(msg: string, err: unknown): never {
  if (err instanceof CommandError) {
    throw new CommandError(msg, err.stderr, { cause: err });
  }
  if (err instanceof Error) {
    throw new Error(`${msg}\n${err.message}`, { cause: err });
  }
  throw new Error(`${msg}\n${String(err)}`, { cause: err });
}

/**
 * 子プロセスを実行して標準出力を返します。
 * 失敗時は`CommandError`を投げます。
 */
export async function run(cmd: string, args: readonly string[]): Promise<string> {
  try {
    const { stdout } = await exec(cmd, args);
    return stdout.trim();
  } catch (err: unknown) {
    throwCommandError(`Command failed: ${cmd} ${args.join(" ")}`, err);
  }
}

/**
 * `run`のエラーを握り潰すバリエーション。
 * upstream未設定時の`git rev-parse @{u}`のように、
 * 失敗自体が情報を持つ呼び出しで使います。
 */
export async function tryRun(cmd: string, args: readonly string[]): Promise<string | undefined> {
  try {
    const { stdout } = await exec(cmd, args);
    return stdout.trim();
  } catch {
    return undefined;
  }
}

/**
 * `CommandError`/`Error`のいずれでも適切に文字列化します。
 * 子プロセス由来の場合は`stderr`が付加されます。
 */
export function displayErrorMessage(err: unknown): string {
  if (err instanceof CommandError) {
    return err.stderr !== "" ? `${err.message}\n${err.stderr}` : err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
