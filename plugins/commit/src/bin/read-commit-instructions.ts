import process from "node:process";
import { readCommitInstructions } from "../read-commit-instructions";

async function main(): Promise<void> {
  const content = await readCommitInstructions();
  if (content != null) {
    process.stdout.write(content);
  }
}

await main();
