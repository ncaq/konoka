/**
 * PRレビューを一括投稿するCLIエントリポイント。
 * コマンドライン引数からJSON形式のレビューデータを受け取り、GitHub APIでレビューを投稿します。
 *
 * 使用例:
 *   node dist/bin/submit-review.js '{"owner":"ncaq","repo":"konoka","prNumber":123,"body":"LGTM","comments":[]}'
 */

import process from "node:process";
import { createOctokitClient } from "../src/client.js";
import { decodeReviewSubmission, submitReview } from "../src/submit-review.js";

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
    if (err instanceof Error) {
      process.stderr.write(`Error: ${err.message}\n`);
    } else {
      process.stderr.write(`Error: ${String(err)}\n`);
    }
    process.exitCode = 1;
  }
}

await main();
