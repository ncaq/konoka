import process from "node:process";
import { prepareEditmsg } from "../prepare-editmsg";

async function main(): Promise<void> {
  const path = await prepareEditmsg();
  process.stdout.write(`${path}\n`);
}

await main();
