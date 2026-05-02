#!/usr/bin/env node
import process from "node:process";
import { formatContributing, readContributing } from "../src/read-contributing.ts";

async function main(): Promise<void> {
  const file = await readContributing();
  if (file != null) {
    process.stdout.write(formatContributing(file));
  }
}

await main();
