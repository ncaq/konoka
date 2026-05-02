#!/usr/bin/env node
import process from "node:process";
import { formatPullRequestTemplates, readPullRequestTemplates } from "../src/read-pull-request-template.ts";

async function main(): Promise<void> {
  const templates = await readPullRequestTemplates();
  if (0 < templates.length) {
    process.stdout.write(formatPullRequestTemplates(templates));
  }
}

await main();
