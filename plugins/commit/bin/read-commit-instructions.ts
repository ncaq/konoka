import { readFile } from "node:fs/promises";
import process from "node:process";

/**
 * Read project-specific commit message guidelines if available.
 *
 * Output (stdout): contents of .github/git-commit-instructions.md, or empty.
 */

async function main(): Promise<void> {
  try {
    process.stdout.write(await readFile(".github/git-commit-instructions.md", "utf8"));
  } catch (err: unknown) {
    // if the file doesn't exist, just output nothing; otherwise, rethrow the error
    if (!(err instanceof Error && "code" in err && err.code === "ENOENT")) {
      throw err;
    }
  }
}

await main();
