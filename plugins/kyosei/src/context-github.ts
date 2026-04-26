/**
 * GitHub出力コンテキストの解析モジュール。
 * PR URLからowner, repo, PR番号を抽出します。
 */

import type { GitHubOutputContext } from "./context-type";

/**
 * 引数文字列を解析してPR URLからコンテキスト情報を抽出します。
 * PR URLでない場合はundefinedを返します。
 *
 * `https://<host>/<owner>/<repo>/pull/<number>`形式を想定しています。
 * 末尾のサブパス(/files, /commits等)やクエリパラメータがあっても問題ありません。
 */
export function parsePrUrl(argument: string): GitHubOutputContext | undefined {
  try {
    const url = new URL(argument.trim());
    const [owner, repo, pullLiteral, prNumberStr] = url.pathname.split("/").filter((s) => s !== "");
    if (owner == null || repo == null || pullLiteral !== "pull" || prNumberStr == null) {
      return undefined;
    }
    const prNumber = Number.parseInt(prNumberStr, 10);
    if (!Number.isFinite(prNumber) || prNumber <= 0) {
      return undefined;
    }
    return { output: "github", host: url.hostname, pr: { owner, repo, prNumber } };
  } catch (err: unknown) {
    // new URL()がURLとして解釈できない文字列で投げるTypeErrorは想定通りなのでローカル出力として扱います。
    if (err instanceof TypeError) {
      console.warn(`argument: "${argument}" is not a valid URL. err is ${err.message}.`);
      return undefined;
    }
    if (err instanceof Error) {
      throw new Error(`failed to parse PR URL: ${err.message}`, { cause: err });
    }
    throw new Error("failed to parse PR URL", { cause: err });
  }
}
