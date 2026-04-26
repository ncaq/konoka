/**
 * レビュー情報を統合的に取得してJSON出力するCLIエントリポイント。
 * SKILL.mdの埋め込みコマンドとして使用します。
 *
 * 使用例:
 *   node dist/bin/get-review-info.js "https://github.com/owner/repo/pull/123"
 *   node dist/bin/get-review-info.js
 */

import process from "node:process";
import { createOctokitClient } from "../src/client";
import { detectReviewContext } from "../src/context";
import { getReviewInfo } from "../src/review-info";

async function main(): Promise<void> {
  try {
    const argument = process.argv[2];
    const octokit = await createOctokitClient();
    const context = await detectReviewContext(octokit, argument);
    const reviewInfo = await getReviewInfo(octokit, context);
    process.stdout.write(JSON.stringify(reviewInfo));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    process.exitCode = 1;
  }
}

await main();
