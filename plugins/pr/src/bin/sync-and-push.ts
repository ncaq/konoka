import process from "node:process";
import { displayErrorMessage } from "../run";
import { formatSyncAndPush, syncAndPush } from "../sync-and-push";

async function main(): Promise<void> {
  try {
    const execResult = await syncAndPush();
    const output = formatSyncAndPush(execResult);
    process.stdout.write(output);
  } catch (err: unknown) {
    console.error(displayErrorMessage(err));
    process.exitCode = 1;
    return;
  }
}

await main();
