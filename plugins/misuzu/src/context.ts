/**
 * レビュー対応コンテキストの判定モジュール。
 * 引数から出力先がGitHubかローカルかを判定し、
 * GitHub出力の場合はURLからowner, repo, PR番号を抽出します。
 * ローカル出力の場合はブランチ情報を解決してベースブランチを特定します。
 */

import { type CommandExecutor } from "@effect/platform";
import { Data, Effect, Either } from "effect";
import type { Octokit } from "octokit";
import { parsePrUrl } from "./context-github";
import { resolveLocalContext } from "./context-local";
import type { ReviewContext } from "./context-type";

/** 引数がPR URLとして解釈できなかった場合の失敗。 */
export class InvalidPrUrlArgument extends Data.TaggedError("InvalidPrUrlArgument")<{
  readonly argument: string;
  readonly reason: string;
}> {
  override get message(): string {
    return `argument: "${this.argument}" is not a recognizable PR URL (${this.reason})`;
  }
}

/**
 * 引数文字列からレビュー対応コンテキストを判定します。
 * 引数が指定された場合はPR URLとしてのみ解釈し、解釈できなければエラーになります。
 * 不正なURLを黙ってローカル解決に落とすと意図しない対象への対応につながるためです。
 * 引数が指定されない場合はローカル解決を行い、ブランチに紐付くPRがあればpr情報を設定します。
 */
export function detectReviewContext(
  octokit: Octokit,
  argument: string | undefined,
): Effect.Effect<ReviewContext, Error, CommandExecutor.CommandExecutor> {
  return Effect.gen(function* () {
    // 引数が指定されていればURLからPRのコンテキストを取得します。
    if (argument != null && argument.trim() !== "") {
      const parsed = parsePrUrl(argument);
      if (Either.isRight(parsed)) {
        return parsed.right;
      }
      return yield* new InvalidPrUrlArgument({ argument, reason: parsed.left });
    }
    // 引数が指定されていない場合はローカル出力向けにブランチ情報を解決します。
    return yield* resolveLocalContext(octokit);
  });
}
