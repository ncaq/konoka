import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

export interface PrepareEditmsgOptions {
  readonly runtimeDir?: string;
}

/** なるべくユーザの固有の作業ディレクトリを返します */
function getPersonalWorkDir(): string {
  const runtimeDir = process.env["XDG_RUNTIME_DIR"];
  if (runtimeDir != null && runtimeDir !== "") {
    return runtimeDir;
  }
  return tmpdir();
}

/** LLMエージェントなどが一時ファイルを置いて良さそうなディレクトリを返します。 */
function getCodingAgentWorkDir(pluginName: string): string {
  const personalWorkDir = getPersonalWorkDir();
  return join(personalWorkDir, "coding-agent-work", pluginName);
}

const pluginName = "pr" as const;
const fileName = "PR_EDITMSG" as const;

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
  const codingAgentWorkDir = getCodingAgentWorkDir(pluginName);
  await mkdir(codingAgentWorkDir, { recursive: true, mode: 0o700 });
  const sessionDir = await mkdtemp(join(codingAgentWorkDir, "session-"));
  return join(sessionDir, fileName);
}
