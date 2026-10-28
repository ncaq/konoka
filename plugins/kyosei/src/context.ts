/**
 * レビューコンテキストの判定モジュール。
 * 引数から出力先がGitHubかローカルかを判定し、
 * GitHub出力の場合はURLからowner, repo, PR番号を抽出します。
 * ローカル出力の場合はブランチ情報を解決してベースブランチを特定します。
 */

import { Effect, Result } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import type { Octokit } from "octokit";
import { parsePrUrl } from "./context-github";
import { resolveLocalContext } from "./context-local";
import type { ReviewContext } from "./context-type";

/**
 * 引数文字列からレビューコンテキストを判定します。
 * 引数がPR URLであればGitHub出力、そうでなければローカル出力となります。
 * ローカル出力の場合、ブランチに紐付くPRがあればpr情報を設定します。
 */
export function detectReviewContext(
  octokit: Octokit,
  argument: string | undefined,
): Effect.Effect<ReviewContext, Error, ChildProcessSpawner.ChildProcessSpawner> {
  return Effect.gen(function* () {
    // 引数が指定されていればURLからPRのコンテキストの取得を試みます。
    if (argument != null && argument.trim() !== "") {
      const parsed = parsePrUrl(argument);
      if (Result.isSuccess(parsed)) {
        return parsed.success;
      }
      yield* Effect.logWarning(
        `argument: "${argument}" is not a recognizable PR URL (${parsed.failure});` +
          " falling back to local context.",
      );
    }
    // 引数が指定されていない場合はローカル出力向けにブランチ情報を解決します。
    return yield* resolveLocalContext(octokit);
  });
}
