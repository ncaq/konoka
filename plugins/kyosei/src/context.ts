/**
 * レビューコンテキストの判定モジュール。
 * 引数から出力先がGitHubかローカルかを判定し、
 * GitHub出力の場合はURLからowner, repo, PR番号を抽出します。
 * ローカル出力の場合はブランチ情報を解決してベースブランチを特定します。
 */

import type { Octokit } from "octokit";
import { parsePrUrl } from "./context-github.js";
import { resolveLocalContext } from "./context-local.js";
import type { ReviewContext } from "./context-type.js";

/**
 * 引数文字列からレビューコンテキストを判定します。
 * 引数がPR URLであればGitHub出力、そうでなければローカル出力となります。
 * ローカル出力の場合、ブランチに紐付くPRがあればpr情報を設定します。
 */
export async function detectReviewContext(octokit: Octokit, argument: string | undefined): Promise<ReviewContext> {
  // 引数が指定されていればURLからPRのコンテキストの取得を試みます。
  if (argument != null && argument.trim() !== "") {
    const prContext = parsePrUrl(argument);
    if (prContext != null) {
      return prContext;
    }
  }
  // 引数が指定されていない場合はローカル出力向けにブランチ情報を解決します。
  return resolveLocalContext(octokit);
}
