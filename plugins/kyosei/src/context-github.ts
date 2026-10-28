/**
 * GitHub出力コンテキストの解析モジュール。
 * PR URLからowner, repo, PR番号を抽出します。
 */

import { Result } from "effect";
import type { GitHubOutputContext } from "./context-type";

/** URL文字列をパースします。例外は失敗理由の文字列として`Result.Failure`に格納します。 */
function parseUrl(raw: string): Result.Result<URL, string> {
  try {
    return Result.succeed(new URL(raw));
  } catch (cause) {
    return Result.fail(
      cause instanceof TypeError
        ? `not a valid URL: ${cause.message}`
        : `unexpected URL parsing error: ${String(cause)}`,
    );
  }
}

/**
 * 引数文字列を解析してPR URLからコンテキスト情報を抽出します。
 * PR URLとして解釈できない場合は失敗理由を`Result.Failure`に格納して返します。
 * 失敗理由は呼び出し側でログ出力に使うためのもので、ローカル解決へのフォールバックは呼び出し側の責務です。
 *
 * `https://<host>/<owner>/<repo>/pull/<number>`形式を想定しています。
 * 末尾のサブパス(/files, /commits等)やクエリパラメータがあっても問題ありません。
 */
export function parsePrUrl(argument: string): Result.Result<GitHubOutputContext, string> {
  return parseUrl(argument.trim()).pipe(
    Result.flatMap((url) => {
      const [owner, repo, pullLiteral, prNumberStr] = url.pathname
        .split("/")
        .filter((s) => s !== "");
      if (owner == null || repo == null || pullLiteral !== "pull" || prNumberStr == null) {
        return Result.fail("URL path is not in /owner/repo/pull/<number> form");
      }
      const prNumber = Number.parseInt(prNumberStr, 10);
      if (!Number.isFinite(prNumber) || prNumber <= 0) {
        return Result.fail(`PR number is not a positive integer: ${prNumberStr}`);
      }
      return Result.succeed<GitHubOutputContext>({
        output: "github",
        host: url.hostname,
        pr: { owner, repo, prNumber },
      });
    }),
  );
}
