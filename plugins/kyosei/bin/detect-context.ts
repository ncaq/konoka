/**
 * レビューコンテキストを判定してJSON出力するCLIエントリポイント。
 * SKILL.mdの埋め込みコマンドとして使用します。
 *
 * 使用例:
 *   node dist/bin/detect-context.js "https://github.com/owner/repo/pull/123"
 *   node dist/bin/detect-context.js
 */

import process from "node:process";
import { detectReviewContext } from "../src/context.js";

function main(): void {
  try {
    const argument = process.argv[2];
    const reviewContext = detectReviewContext(argument);
    process.stdout.write(JSON.stringify(reviewContext));
  } catch (err: unknown) {
    if (err instanceof Error) {
      process.stderr.write(`Error: ${err.message}`);
    } else {
      process.stderr.write(`Error: ${String(err)}`);
    }
    process.exitCode = 1;
  }
}

main();
