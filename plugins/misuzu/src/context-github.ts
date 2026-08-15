/**
 * GitHub出力コンテキストの解析モジュール。
 * PR URLからowner, repo, PR番号と優先対応対象(focus)を抽出します。
 */

import { Either } from "effect";
import type { Focus, GitHubOutputContext } from "./context-type";

/**
 * フラグメントの形式とfocus種別の対応。
 * 接頭辞の部分一致ではなくフラグメント全体との完全一致で判定し、
 * `r`のような短い接頭辞が他の形式を誤って拾わないようにしています。
 */
const focusPatternList: readonly { pattern: RegExp; kind: Focus["kind"] }[] = [
  // レビュー全体。例: #pullrequestreview-123456789
  { pattern: /^pullrequestreview-([0-9]+)$/, kind: "review" },
  // Conversationタブのレビュースレッドコメント。例: #discussion_r123456789
  { pattern: /^discussion_r([0-9]+)$/, kind: "review-comment" },
  // Files changedタブのレビュースレッドコメント。例: /files#r123456789
  { pattern: /^r([0-9]+)$/, kind: "review-comment" },
  // PR全体へのコメント。例: #issuecomment-123456789
  { pattern: /^issuecomment-([0-9]+)$/, kind: "issue-comment" },
];

/**
 * URLフラグメントから優先対応対象を抽出します。
 * 未知の形式のフラグメントはfocusなし(`undefined`)として扱います。
 */
export function parseFocusFragment(hash: string): Focus | undefined {
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  for (const { pattern, kind } of focusPatternList) {
    const idStr = pattern.exec(fragment)?.[1];
    if (idStr != null) {
      const databaseId = Number.parseInt(idStr, 10);
      if (Number.isSafeInteger(databaseId) && 0 < databaseId) {
        return { kind, databaseId };
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
