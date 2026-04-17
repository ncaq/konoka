/**
 * 変更セットを取得してJSON出力するCLIエントリポイント。
 * SKILL.mdの埋め込みコマンドとして使用します。
 *
 * 使用例:
 *   node dist/bin/get-changeset.js "https://github.com/owner/repo/pull/123"
 *   node dist/bin/get-changeset.js
 */

import process from "node:process";
import { getChangeset } from "../src/changeset.js";
import { createOctokitClient } from "../src/client.js";
import { detectReviewContext } from "../src/context.js";

async function main(): Promise<void> {
  try {
    const argument = process.argv[2];
    const context = detectReviewContext(argument);
    const octokit = await createOctokitClient();
    const changeset = await getChangeset(octokit, context);
    process.stdout.write(JSON.stringify(changeset));
  } catch (err: unknown) {
    if (err instanceof Error) {
      process.stderr.write(`Error: ${err.message}`);
    } else {
      process.stderr.write(`Error: ${String(err)}`);
    }
    process.exitCode = 1;
  }
}

await main();
