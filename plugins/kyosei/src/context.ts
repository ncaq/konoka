/**
 * レビューコンテキストの判定モジュール。
 * 引数から出力先がGitHubかローカルかを判定し、
 * GitHub出力の場合はURLからowner, repo, PR番号を抽出します。
 * ローカル出力の場合はブランチ情報を解決してベースブランチを特定します。
 */

import { type CommandExecutor } from "@effect/platform";
import { Effect, Either } from "effect";
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
): Effect.Effect<ReviewContext, Error, CommandExecutor.CommandExecutor> {
  return Effect.gen(function* () {
    // 引数が指定されていればURLからPRのコンテキストの取得を試みます。
    if (argument != null && argument.trim() !== "") {
      const parsed = parsePrUrl(argument);
      if (Either.isRight(parsed)) {
        return parsed.right;
      }
      yield* Effect.logWarning(
        `argument: "${argument}" is not a recognizable PR URL (${parsed.left}); falling back to local context.`,
      );
    }
    // 引数が指定されていない場合はローカル出力向けにブランチ情報を解決します。
    return yield* resolveLocalContext(octokit);
  });
}
