import process from "node:process";
import { formatContributing, readContributing } from "../read-contributing";

async function main(): Promise<void> {
  const file = await readContributing();
  if (file != null) {
    process.stdout.write(formatContributing(file));
  }
}

await main();
