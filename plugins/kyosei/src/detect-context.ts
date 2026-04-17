/**
 * レビューコンテキストを判定してJSON出力するCLIエントリポイント。
 * SKILL.mdの埋め込みコマンドとして使用します。
 *
 * 使用例:
 *   node dist/detect-context.js "https://github.com/owner/repo/pull/123"
 *   node dist/detect-context.js
 */

import process from "node:process";
import { detectReviewContext } from "./context.js";

function main(): void {
  const argument = process.argv[2];
  const reviewContext = detectReviewContext(argument);
  process.stdout.write(JSON.stringify(reviewContext));
}

main();
