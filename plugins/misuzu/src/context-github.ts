/**
 * GitHub出力コンテキストの解析モジュール。
 * PR URLからowner, repo, PR番号と優先対応対象(focus)を抽出します。
 */

import { Either } from "effect";
import type { Focus, GitHubOutputContext } from "./context-type";

/** フラグメントの接頭辞とfocus種別の対応。 */
const focusPrefixList: readonly { prefix: string; kind: Focus["kind"] }[] = [
  // レビュー全体。例: #pullrequestreview-123456789
  { prefix: "pullrequestreview-", kind: "review" },
  // Conversationタブのレビュースレッドコメント。例: #discussion_r123456789
  { prefix: "discussion_r", kind: "review-comment" },
  // Files changedタブのレビュースレッドコメント。例: /files#r123456789
  { prefix: "r", kind: "review-comment" },
  // PR全体へのコメント。例: #issuecomment-123456789
  { prefix: "issuecomment-", kind: "issue-comment" },
];

/**
 * URLフラグメントから優先対応対象を抽出します。
 * 未知の形式のフラグメントはfocusなし(`undefined`)として扱います。
 */
export function parseFocusFragment(hash: string): Focus | undefined {
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  if (fragment === "") {
    return undefined;
  }
  for (const { prefix, kind } of focusPrefixList) {
    if (fragment.startsWith(prefix)) {
      const idStr = fragment.slice(prefix.length);
      if (/^[0-9]+$/.test(idStr)) {
        const databaseId = Number.parseInt(idStr, 10);
        if (Number.isSafeInteger(databaseId) && 0 < databaseId) {
          return { kind, databaseId };
        }
      }
    }
  }
  return undefined;
}

/**
 * 引数文字列を解析してPR URLからコンテキスト情報を抽出します。
 * PR URLとして解釈できない場合は失敗理由を`Either.Left`に格納して返します。
 * 失敗時の取り扱い(エラー化)は呼び出し側の責務です。
 *
 * `https://<host>/<owner>/<repo>/pull/<number>`形式を想定しています。
 * 末尾のサブパス(/files, /commits等)やクエリパラメータがあっても問題ありません。
 * `#pullrequestreview-<id>`等のフラグメントは優先対応対象(focus)として抽出します。
 */
export function parsePrUrl(argument: string): Either.Either<GitHubOutputContext, string> {
  return Either.try({
    try: () => new URL(argument.trim()),
    catch: (cause) =>
      cause instanceof TypeError
        ? `not a valid URL: ${cause.message}`
        : `unexpected URL parsing error: ${String(cause)}`,
  }).pipe(
    Either.flatMap((url) => {
      const [owner, repo, pullLiteral, prNumberStr] = url.pathname
        .split("/")
        .filter((s) => s !== "");
      if (owner == null || repo == null || pullLiteral !== "pull" || prNumberStr == null) {
        return Either.left("URL path is not in /owner/repo/pull/<number> form");
      }
      const prNumber = Number.parseInt(prNumberStr, 10);
      if (!Number.isFinite(prNumber) || prNumber <= 0) {
        return Either.left(`PR number is not a positive integer: ${prNumberStr}`);
      }
      const focus = parseFocusFragment(url.hash);
      return Either.right<GitHubOutputContext>({
        output: "github",
        host: url.hostname,
        pr: { owner, repo, prNumber },
        ...(focus == null ? {} : { focus }),
      });
    }),
  );
}
