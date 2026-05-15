import process from "node:process";
import {
  formatPullRequestTemplates,
  readPullRequestTemplates,
} from "../read-pull-request-template";

async function main(): Promise<void> {
  const templates = await readPullRequestTemplates();
  if (0 < templates.length) {
    process.stdout.write(formatPullRequestTemplates(templates));
  }
}

await main();
