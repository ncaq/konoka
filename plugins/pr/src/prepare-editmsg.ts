import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const PLUGIN_NAME = "pr" as const;
const FILE_NAME = "PR_EDITMSG" as const;

export interface PrepareEditmsgOptions {
  readonly runtimeDir?: string;
}

/**
 * セッション固有の一時ディレクトリを作成し、`PR_EDITMSG`ファイルのフルパスを返します。
 *
 * 作業ディレクトリの基底は`$XDG_RUNTIME_DIR/coding-agent-work/pr/`を使い、
 * 未設定環境では`os.tmpdir()`にフォールバックします。
 * 親ディレクトリが無い場合は`mkdir -p`相当で再帰的に作成し、
 * その下に`mkdtemp`でセッション固有のサブディレクトリを掘ります。
 * `PR_EDITMSG`本体は呼び出し側でこのパスに書き出してください。
 */
export async function prepareEditmsg(options: PrepareEditmsgOptions = {}): Promise<string> {
  const runtimeDir = options.runtimeDir ?? process.env["XDG_RUNTIME_DIR"] ?? tmpdir();
  const parent = join(runtimeDir, "coding-agent-work", PLUGIN_NAME);
  await mkdir(parent, { recursive: true });
  const sessionDir = await mkdtemp(join(parent, "session-"));
  return join(sessionDir, FILE_NAME);
}
