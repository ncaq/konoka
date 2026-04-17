/**
 * レビューコンテキストの判定モジュール。
 * 引数からPRレビューかローカルレビューかを判定し、
 * PRレビューの場合はURLからowner, repo, PR番号を抽出します。
 */

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
 *
 * `https://<host>/<owner>/<repo>/pull/<number>`形式を想定しています。
 * 末尾のサブパス(/files, /commits等)やクエリパラメータがあっても問題ありません。
 */
function parsePrUrl(argument: string): PrReviewContext | undefined {
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
    return { mode: "pr", host: url.hostname, owner, repo, prNumber };
  } catch (err: unknown) {
    // new URL()がURLとして解釈できない文字列で投げるTypeErrorは想定通りなのでローカルモードとして扱います。
    if (err instanceof TypeError) {
      return undefined;
    }
    if (err instanceof Error) {
      throw new Error(`failed to parse PR URL: ${err.message}`, { cause: err });
    }
    throw new Error("failed to parse PR URL", { cause: err });
  }
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
