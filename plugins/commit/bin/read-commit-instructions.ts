#!/usr/bin/env node
import process from "node:process";
import { readCommitInstructions } from "../src/read-commit-instructions.ts";

async function main(): Promise<void> {
  const content = await readCommitInstructions();
  if (content != null) {
    process.stdout.write(content);
  }
}

await main();
