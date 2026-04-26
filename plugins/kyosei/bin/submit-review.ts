/**
 * PRレビューを一括投稿するCLIエントリポイント。
 * コマンドライン引数からJSON形式のレビューデータを受け取り、GitHub APIでレビューを投稿します。
 */

import process from "node:process";
import { createOctokitClient } from "../src/client";
import { decodeReviewSubmission, submitReview } from "../src/submit-review";

async function main(): Promise<void> {
  try {
    const input = process.argv[2];
    if (input == null) {
      throw new Error("JSON argument is required");
    }
    const submission = decodeReviewSubmission(input);
    const octokit = await createOctokitClient();
    const submissionResult = await submitReview(octokit, submission);
    process.stdout.write(JSON.stringify(submissionResult) + "\n");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}\n`);
    process.exitCode = 1;
  }
}

await main();
