import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Thrown when there is nothing to commit. */
export class EmptyCommitError extends Error {
  override name = "EmptyCommitError" as const;
  constructor(message: string) {
    super(message);
  }
}

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

const pluginName = "commit" as const;

async function git(...args: readonly string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { maxBuffer: 10 * 1024 * 1024 });
  return stdout.trimEnd();
}

function getPersonalWorkDir(): string {
  const runtimeDir = process.env["XDG_RUNTIME_DIR"];
  if (runtimeDir != null && runtimeDir !== "") {
    return runtimeDir;
  }
  return tmpdir();
}

function getCodingAgentWorkDir(): string {
  return join(getPersonalWorkDir(), "coding-agent-work", pluginName);
}

async function createWorkdirPath(): Promise<string> {
  const codingAgentWorkDir = getCodingAgentWorkDir();
  await mkdir(codingAgentWorkDir, { recursive: true, mode: 0o700 });
  return mkdtemp(join(codingAgentWorkDir, `${timestamp()}-`));
}

async function ensureStaged(): Promise<void> {
  const status = await git("status", "--porcelain");
  if (status === "") {
    throw new EmptyCommitError("No changes to commit.");
  }
  if (!hasStagedChanges(status)) {
    await git("add", "--all");
  }
}

async function getStagedDiff(): Promise<string> {
  const diff = await git("diff", "--cached");
  if (diff === "") {
    throw new EmptyCommitError("No staged changes to commit.");
  }
  return diff;
}

async function stageThenDiff(): Promise<string> {
  await ensureStaged();
  return getStagedDiff();
}

async function writeEditmsgTemplate(workdirPath: string, diff: string): Promise<string> {
  const editmsgPath = join(workdirPath, "COMMIT_EDITMSG");
  await writeFile(editmsgPath, buildEditmsgTemplate(diff));
  return editmsgPath;
}

/**
 * ステージ済みの変更を確保し、`COMMIT_EDITMSG`テンプレートを書き出して、
 * その絶対パスを返します。
 *
 * `$XDG_RUNTIME_DIR/coding-agent-work/commit/`配下にタイムスタンプ付きの
 * 一時ディレクトリを作り、scissors lineと差分を含むテンプレートを配置します。
 * 未設定環境では`os.tmpdir()`にフォールバックします。
 *
 * 何もステージできるものが無い場合は`EmptyCommitError`を投げます。
 */
export async function prepareCommit(): Promise<string> {
  const [workdirPath, diff] = await Promise.all([createWorkdirPath(), stageThenDiff()]);
  return writeEditmsgTemplate(workdirPath, diff);
}
