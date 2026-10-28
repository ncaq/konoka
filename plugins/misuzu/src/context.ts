/**
 * レビュー対応コンテキストの判定モジュール。
 * 引数のPR URLからowner, repo, PR番号を抽出するか、
 * 引数がなければカレントブランチからPRを探索します。
 */

import { Data, Effect, Option, Result } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import type { Octokit } from "octokit";
import { parsePrUrl } from "./context-github";
import { findPrForCurrentBranch } from "./context-local";
import type { RespondContext } from "./context-type";

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
 * 引数が指定されない場合はカレントブランチからPRを探索し、
 * 見つからなければ`pr`を持たないコンテキストを返します。
 */
export function detectRespondContext(
  octokit: Octokit,
  argument: string | undefined,
): Effect.Effect<RespondContext, Error, ChildProcessSpawner.ChildProcessSpawner> {
  return Effect.gen(function* () {
    // 引数が指定されていればURLからPRのコンテキストを取得します。
    if (argument != null && argument.trim() !== "") {
      const parsed = parsePrUrl(argument);
      if (Result.isSuccess(parsed)) {
        return parsed.success;
      }
      return yield* new InvalidPrUrlArgument({ argument, reason: parsed.failure });
    }
    // 引数が指定されていない場合はカレントブランチからPRを探索します。
    const pr = yield* findPrForCurrentBranch(octokit);
    return Option.match(pr, {
      onSome: (value): RespondContext => ({ pr: value }),
      onNone: (): RespondContext => ({}),
    });
  });
}
