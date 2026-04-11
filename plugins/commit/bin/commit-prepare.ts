import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { EmptyCommitError, buildEditmsgTemplate, hasStagedChanges, timestamp } from "../lib/commit-prepare.ts";

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

/** Run a git command and return its stdout with trailing whitespace trimmed. */
async function git(...args: readonly string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", [...args]);
  return stdout.trimEnd();
}

/** Create a secure temporary working directory under $XDG_RUNTIME_DIR. */
async function createWorkdirPath(): Promise<string> {
  const basePath = join(process.env["XDG_RUNTIME_DIR"] ?? "/tmp", "coding-agent-work", "commit");
  await mkdir(basePath, { recursive: true, mode: 0o700 });
  return mkdtemp(join(basePath, `${timestamp()}-`));
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
  await writeFile(editmsgPath, buildEditmsgTemplate(diff));
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
