/**
 * 変更セットの取得を行うモジュール。
 * PRモードではOctokit経由でGitHub APIから取得し、
 * ローカルモードではcontextに解決済みのブランチ情報を使って
 * gitコマンドで差分を取得します。
 */

import type { Octokit } from "octokit";
import type { GitHubOutputContext, LocalOutputContext, ReviewContext } from "./context-type.js";
import { execFileAsync } from "./exec.js";

/**
 * レビュー対象の変更セット。
 * 差分とコミットログを含みます。
 */
export interface Changeset {
  readonly diff: string;
  readonly log: string;
}

/**
 * PRレビューモードの変更セットを取得します。
 * GitHub APIからdiff形式で差分を取得し、
 * コミット一覧もAPIから取得します。
 */
async function getPrChangeset(octokit: Octokit, context: GitHubOutputContext): Promise<Changeset> {
  const [diffResponse, commitsResponse] = await Promise.all([
    octokit.rest.pulls.get({
      owner: context.pr.owner,
      repo: context.pr.repo,
      pull_number: context.pr.prNumber,
      mediaType: { format: "diff" },
    }),
    octokit.rest.pulls.listCommits({
      owner: context.pr.owner,
      repo: context.pr.repo,
      pull_number: context.pr.prNumber,
      per_page: 100, // コミットログは100件以上は追いません。なくてもレビューは可能ですし。
    }),
  ]);
  const log = commitsResponse.data
    .map((c) => {
      // まず入ってないことはないと思うので雑なフォールバック値を設定しています。
      const authorName = c.commit.author?.name ?? "unknown-author-name";
      const authorDate = c.commit.author?.date ?? "unknown-author-date";
      return `commit ${c.sha}\nAuthor: ${authorName}\nDate: ${authorDate}\n\n    ${c.commit.message}\n`;
    })
    .join("\n");
  // mediaType diffを指定するとレスポンスが文字列になります。
  if (typeof diffResponse.data !== "string") {
    throw new Error("unexpected response type for diff");
  }
  return {
    diff: diffResponse.data,
    log,
  };
}

/**
 * ローカルレビューモードの変更セットを取得します。
 * contextのbaseBranchとremoteNameからdiffとlogを生成します。
 */
async function getLocalChangeset(context: LocalOutputContext): Promise<Changeset> {
  const base = context.remoteName != null ? `${context.remoteName}/${context.baseBranch}` : context.baseBranch;
  const range = `${base}...HEAD`;
  const [gitDiffOutput, gitLogOutput] = await Promise.all([
    execFileAsync("git", ["diff", range]),
    execFileAsync("git", ["log", range]),
  ]);
  return {
    diff: gitDiffOutput.stdout,
    log: gitLogOutput.stdout,
  };
}

/**
 * レビューコンテキストに応じて変更セットを取得します。
 */
export async function getChangeset(octokit: Octokit, context: ReviewContext): Promise<Changeset> {
  if (context.output === "github") {
    return getPrChangeset(octokit, context);
  }
  return getLocalChangeset(context);
}
