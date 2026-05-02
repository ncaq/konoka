#!/usr/bin/env node
import process from "node:process";
import { prepareEditmsg } from "../src/prepare-editmsg.ts";

async function main(): Promise<void> {
  const path = await prepareEditmsg();
  process.stdout.write(`${path}\n`);
}

await main();
