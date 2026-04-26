/**
 * GitHub出力コンテキストの解析モジュール。
 * PR URLからowner, repo, PR番号を抽出します。
 */

import { Either } from "effect";
import type { GitHubOutputContext } from "./context-type";

/**
 * 引数文字列を解析してPR URLからコンテキスト情報を抽出します。
 * PR URLとして解釈できない場合は失敗理由を`Either.Left`に格納して返します。
 * 失敗理由は呼び出し側でログ出力に使うためのもので、ローカル解決へのフォールバックは呼び出し側の責務です。
 *
 * `https://<host>/<owner>/<repo>/pull/<number>`形式を想定しています。
 * 末尾のサブパス(/files, /commits等)やクエリパラメータがあっても問題ありません。
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
      const [owner, repo, pullLiteral, prNumberStr] = url.pathname.split("/").filter((s) => s !== "");
      if (owner == null || repo == null || pullLiteral !== "pull" || prNumberStr == null) {
        return Either.left("URL path is not in /owner/repo/pull/<number> form");
      }
      const prNumber = Number.parseInt(prNumberStr, 10);
      if (!Number.isFinite(prNumber) || prNumber <= 0) {
        return Either.left(`PR number is not a positive integer: ${prNumberStr}`);
      }
      return Either.right<GitHubOutputContext>({
        output: "github",
        host: url.hostname,
        pr: { owner, repo, prNumber },
      });
    }),
  );
}
