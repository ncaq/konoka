/**
 * PRレビューを一括投稿するCLIエントリポイント。
 * stdinからJSON形式のレビューデータを受け取り、GitHub APIでレビューを投稿します。
 *
 * 使用例:
 *   node dist/bin/submit-review.js <<'KYOSEI_SUBMIT_REVIEW_JSON_INPUT_HEREDOC_DELIMITER'
 *   {"owner":"ncaq","repo":"konoka","prNumber":123,"event":"COMMENT","body":"LGTM","comments":[]}
 *   KYOSEI_SUBMIT_REVIEW_JSON_INPUT_HEREDOC_DELIMITER
 */

import process from "node:process";
import { text } from "node:stream/consumers";
import { createOctokitClient } from "../src/client.js";
import { decodeReviewSubmission, submitReview } from "../src/submit-review.js";

async function main(): Promise<void> {
  try {
    const input = await text(process.stdin);
    const submission = decodeReviewSubmission(input);
    const octokit = await createOctokitClient();
    const submissionResult = await submitReview(octokit, submission);
    process.stdout.write(JSON.stringify(submissionResult));
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
