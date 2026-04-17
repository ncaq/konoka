/**
 * 変更セットを取得してJSON出力するCLIエントリポイント。
 * SKILL.mdの埋め込みコマンドとして使用します。
 *
 * 使用例:
 *   node dist/src/get-changeset.js "https://github.com/owner/repo/pull/123"
 *   node dist/src/get-changeset.js
 */

import process from "node:process";
import { getChangeset } from "./changeset.js";
import { createOctokitClient } from "./client.js";
import { detectReviewContext } from "./context.js";

async function main(): Promise<void> {
  const argument = process.argv[2];
  const context = detectReviewContext(argument);
  const octokit = await createOctokitClient();
  const changeset = await getChangeset(octokit, context);
  process.stdout.write(JSON.stringify(changeset));
}

await main();
