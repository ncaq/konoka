/**
 * レビューコンテキストの判定モジュール。
 * 引数からPRレビューかローカルレビューかを判定し、
 * PRレビューの場合はURLからowner, repo, PR番号を抽出します。
 */

import { prUrlPattern } from "./pattern.js";

/**
 * PRレビューのコンテキスト。
 * GitHub PRのURLから抽出された情報を保持します。
 */
export interface PrReviewContext {
  readonly mode: "pr";
  /** GitHubのホスト名。github.comまたはGitHub Enterpriseのドメイン。 */
  readonly host: string;
  /** リポジトリの所有者。ユーザーまたはOrganization。 */
  readonly owner: string;
  /** リポジトリ名。 */
  readonly repo: string;
  /** PR番号。 */
  readonly prNumber: number;
}

/**
 * ローカルレビューのコンテキスト。
 * 引数が指定されなかった場合にこのモードになります。
 */
export interface LocalReviewContext {
  readonly mode: "local";
}

/**
 * レビューコンテキストの判別共用体。
 */
export type ReviewContext = PrReviewContext | LocalReviewContext;

/**
 * 引数文字列を解析してPR URLからコンテキスト情報を抽出します。
 * PR URLでない場合はundefinedを返します。
 */
function parsePrUrl(argument: string): PrReviewContext | undefined {
  const match = prUrlPattern.exec(argument.trim());
  if (match == null) {
    return undefined;
  }
  const [, host, owner, repo, prNumberStr] = match;
  // 正規表現のキャプチャグループは全て必須なので型安全のためにチェックします。
  if (host == null || owner == null || repo == null || prNumberStr == null) {
    return undefined;
  }
  const prNumber = Number.parseInt(prNumberStr, 10);
  if (!Number.isFinite(prNumber) || prNumber <= 0) {
    return undefined;
  }
  return { mode: "pr", host, owner, repo, prNumber };
}

/**
 * 引数文字列からレビューコンテキストを判定します。
 * 引数がPR URLであればPRレビュー、そうでなければローカルレビューとなります。
 */
export function detectReviewContext(argument: string | undefined): ReviewContext {
  if (argument == null || argument.trim() === "") {
    return { mode: "local" };
  }
  const prContext = parsePrUrl(argument);
  if (prContext != null) {
    return prContext;
  }
  return { mode: "local" };
}
