import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { promisify } from "node:util";

/**
 * Prepare for commit: stage changes, write COMMIT_EDITMSG template.
 *
 * Output (stdout): path to the COMMIT_EDITMSG file.
 * Side-effect: writes <workdir>/COMMIT_EDITMSG with scissors template.
 *
 * Exit codes:
 *   0 - success
 *   1 - no changes to commit
 */

const execFileAsync = promisify(execFile);

/** Thrown when there is nothing to commit. */
class EmptyCommitError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/** Run a git command and return its stdout with trailing whitespace trimmed. */
async function git(...args: readonly string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", [...args]);
  return stdout.trimEnd();
}

/** Generate an ISO 8601-like timestamp for use in directory names. */
function timestamp(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  return `${date}T${time}`;
}

/** Create a secure temporary working directory under $XDG_RUNTIME_DIR. */
async function createWorkdirPath(): Promise<string> {
  const basePath = join(process.env["XDG_RUNTIME_DIR"] ?? "/tmp", "coding-agent-work", "commit");
  await mkdir(basePath, { recursive: true, mode: 0o700 });
  return mkdtemp(join(basePath, `${timestamp()}-`));
}

/** Check whether git status --porcelain output contains staged entries. */
function hasStagedChanges(status: string): boolean {
  return status.split("\n").some((line) => {
    const index = line[0];
    return index != null && index !== " " && index !== "?";
  });
}

/** Stage all changes if nothing is staged yet. Throws if there are no changes at all. */
async function ensureStaged(): Promise<void> {
  const status = await git("status", "--porcelain");

  if (status === "") {
    throw new EmptyCommitError("No changes to commit.");
  }

  if (!hasStagedChanges(status)) {
    await git("add", "--all");
  }
}

/** Get the staged diff. Throws if no staged changes exist. */
async function getStagedDiff(): Promise<string> {
  const diff = await git("diff", "--cached");

  if (diff === "") {
    throw new EmptyCommitError("No staged changes to commit.");
  }

  return diff;
}

/** Write a COMMIT_EDITMSG file with scissors line and diff as template. */
async function writeEditmsgTemplate(workdirPath: string, diff: string): Promise<string> {
  const editmsgPath = join(workdirPath, "COMMIT_EDITMSG");
  const template = `\n# ------------------------ >8 ------------------------\n${diff}\n`;
  await writeFile(editmsgPath, template);
  return editmsgPath;
}

/** Stage changes, write COMMIT_EDITMSG template, and print its path. */
async function main(): Promise<void> {
  const workdirPath = await createWorkdirPath();
  await ensureStaged();
  const diff = await getStagedDiff();
  const editmsgPath = await writeEditmsgTemplate(workdirPath, diff);
  console.log(editmsgPath);
}

await main();
