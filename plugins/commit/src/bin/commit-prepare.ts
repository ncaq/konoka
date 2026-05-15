import process from "node:process";
import { EmptyCommitError, prepareCommit } from "../commit-prepare";

async function main(): Promise<void> {
  try {
    const path = await prepareCommit();
    process.stdout.write(`${path}\n`);
  } catch (err: unknown) {
    if (err instanceof EmptyCommitError) {
      console.error(err.message);
      process.exitCode = 1;
      return;
    }
    throw err;
  }
}

await main();
