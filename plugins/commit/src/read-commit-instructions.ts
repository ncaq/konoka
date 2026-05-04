import { readFile } from "node:fs/promises";

const COMMIT_INSTRUCTIONS_PATH = ".github/git-commit-instructions.md" as const;

/**
 * Read project-specific commit message guidelines if available.
 *
 * Returns the file contents as UTF-8 text, or `undefined` when the file does not exist.
 */
export async function readCommitInstructions(): Promise<string | undefined> {
  try {
    return await readFile(COMMIT_INSTRUCTIONS_PATH, "utf8");
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") {
      return undefined;
    }
    throw err;
  }
}
