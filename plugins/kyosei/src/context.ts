/**
 * レビューコンテキストの判定モジュール。
 * 引数から出力先がGitHubかローカルかを判定し、
 * GitHub出力の場合はURLからowner, repo, PR番号を抽出します。
 * ローカル出力の場合もブランチに紐付くPRをOctokitで検索します。
 */

import type { Octokit } from "octokit";
import { execFileAsync } from "./exec.js";
import { getRemoteName, getRemoteRepo } from "./remote.js";

/**
 * PRの識別情報。
 * owner, repo, PR番号の組み合わせでPRを一意に特定します。
 */
export interface PrIdentifier {
  /** リポジトリの所有者。ユーザーまたはOrganization。 */
  readonly owner: string;
  /** リポジトリ名。 */
  readonly repo: string;
  /** PR番号。 */
  readonly prNumber: number;
}

/**
 * GitHub出力のコンテキスト。
 * GitHub PRのURLから抽出された情報を保持します。
 * レビュー結果はGitHub PRにコメントとして投稿されます。
 */
export interface GitHubOutputContext {
  readonly output: "github";
  /** GitHubのホスト名。github.comまたはGitHub Enterpriseのドメイン。 */
  readonly host: string;
  readonly pr: PrIdentifier;
}

/**
 * ローカル出力のコンテキスト。
 * 引数が指定されないか、PR URLとして解析できない場合にこの出力先になります。
 * レビュー結果はターミナルに直接出力されます。
 */
export interface LocalOutputContext {
  readonly output: "local";
  readonly pr?: PrIdentifier;
  /** diff対象のベースブランチ名。PRのベースまたはリポジトリのデフォルトブランチ。 */
  readonly baseBranch: string;
  /** gitリモート名。省略時は"origin"として扱います。 */
  readonly remoteName?: string;
}

/**
 * レビューコンテキストの判別共用体。
 */
export type ReviewContext = GitHubOutputContext | LocalOutputContext;

/**
 * 引数文字列を解析してPR URLからコンテキスト情報を抽出します。
 * PR URLでない場合はundefinedを返します。
 *
 * `https://<host>/<owner>/<repo>/pull/<number>`形式を想定しています。
 * 末尾のサブパス(/files, /commits等)やクエリパラメータがあっても問題ありません。
 */
function parsePrUrl(argument: string): GitHubOutputContext | undefined {
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

/**
 * gitのsymbolic-refからリモートのデフォルトブランチ名を取得します。
 * `git remote set-head`で設定されている必要があります。
 */
async function getDefaultBranchFromGit(remoteName: string): Promise<string> {
  const symbolicRef = await execFileAsync("git", ["symbolic-ref", `refs/remotes/${remoteName}/HEAD`]);
  // "refs/remotes/origin/main" → "main"
  const prefix = `refs/remotes/${remoteName}/`;
  const ref = symbolicRef.stdout.trim();
  if (!ref.startsWith(prefix)) {
    throw new Error(`unexpected symbolic-ref format: ${ref}`);
  }
  return ref.slice(prefix.length);
}

/**
 * ローカル出力向けにブランチ情報を解決します。
 * GitHub APIが利用可能なら、PRのベースブランチまたはリポジトリのデフォルトブランチを取得します。
 * GitHub APIが利用できない場合はgitのsymbolic-refからデフォルトブランチを取得します。
 */
async function resolveLocalContext(octokit: Octokit): Promise<LocalOutputContext> {
  const [remoteName, currentBranchOutput] = await Promise.all([
    getRemoteName(),
    execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"]),
  ]);
  const currentBranch = currentBranchOutput.stdout.trim();
  try {
    const remoteRepo = await getRemoteRepo();
    const prListResponse = await octokit.rest.pulls.list({
      owner: remoteRepo.owner,
      repo: remoteRepo.repo,
      head: `${remoteRepo.owner}:${currentBranch}`,
      state: "open",
      per_page: 1,
    });
    const pr = prListResponse.data[0];
    if (pr != null) {
      return {
        output: "local",
        pr: { owner: remoteRepo.owner, repo: remoteRepo.repo, prNumber: pr.number },
        baseBranch: pr.base.ref,
        remoteName,
      };
    }
    // PRが見つからない場合はデフォルトブランチにフォールバックします。
    const repoResponse = await octokit.rest.repos.get({
      owner: remoteRepo.owner,
      repo: remoteRepo.repo,
    });
    return { output: "local", baseBranch: repoResponse.data.default_branch, remoteName };
  } catch (err: unknown) {
    // GitHub APIやURL解析が利用できない場合はgitからデフォルトブランチを取得します。
    console.warn(`GitHub API unavailable, falling back to git: ${err instanceof Error ? err.message : String(err)}`);
    const baseBranch = await getDefaultBranchFromGit(remoteName);
    return { output: "local", baseBranch, remoteName };
  }
}

/**
 * 引数文字列からレビューコンテキストを判定します。
 * 引数がPR URLであればGitHub出力、そうでなければローカル出力となります。
 * ローカル出力の場合、ブランチに紐付くPRがあればpr情報を設定します。
 */
export async function detectReviewContext(octokit: Octokit, argument: string | undefined): Promise<ReviewContext> {
  // 引数が指定されていればURLからPRのコンテキストの取得を試みます。
  if (argument != null && argument.trim() !== "") {
    const prContext = parsePrUrl(argument);
    if (prContext != null) {
      return prContext;
    }
  }
  // 引数が指定されていない場合はローカル出力向けにブランチ情報を解決します。
  return resolveLocalContext(octokit);
}
