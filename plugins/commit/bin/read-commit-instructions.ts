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
  } catch {
    // no project-specific instructions
  }
}

await main();
