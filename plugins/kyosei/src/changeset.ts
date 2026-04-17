/**
 * 変更セットの取得を行うモジュール。
 * PRモードではOctokit経由でGitHub APIから取得し、
 * ローカルモードではベースブランチの特定にOctokitを使い、
 * 差分自体はgitコマンドで取得します。
 */

import type { Octokit } from "octokit";
import type { PrReviewContext, ReviewContext } from "./context.js";
import { execFileAsync } from "./exec.js";
import { getRemoteRepo, type RemoteRepo } from "./remote.js";

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
async function getPrChangeset(octokit: Octokit, context: PrReviewContext): Promise<Changeset> {
  const [diffResponse, commitsResponse] = await Promise.all([
    octokit.rest.pulls.get({
      owner: context.owner,
      repo: context.repo,
      pull_number: context.prNumber,
      mediaType: { format: "diff" },
    }),
    octokit.rest.pulls.listCommits({
      owner: context.owner,
      repo: context.repo,
      pull_number: context.prNumber,
      per_page: 200, // コミットログは200件以上は追いません。なくてもレビューは可能ですし。
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
 * 現在のブランチ名を取得します。
 */
async function getCurrentBranch(): Promise<string> {
  return (await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim();
}

/**
 * リポジトリのデフォルトブランチを取得します。
 */
async function getDefaultBranch(octokit: Octokit, remoteRepo: RemoteRepo): Promise<string> {
  const repoResponse = await octokit.rest.repos.get({
    owner: remoteRepo.owner,
    repo: remoteRepo.repo,
  });
  return repoResponse.data.default_branch;
}

/**
 * ローカルブランチのベースブランチを特定し、リモート名と合わせて返します。
 * まず現在のブランチに対応するPRがあればそのベースブランチを使い、
 * なければリポジトリのデフォルトブランチにフォールバックします。
 */
async function getLocalBaseBranch(octokit: Octokit): Promise<{ remoteRepo: RemoteRepo; baseBranch: string }> {
  const [remoteRepo, currentBranch] = await Promise.all([getRemoteRepo(), getCurrentBranch()]);
  try {
    const prListResponse = await octokit.rest.pulls.list({
      owner: remoteRepo.owner,
      repo: remoteRepo.repo,
      head: `${remoteRepo.owner}:${currentBranch}`,
      state: "open",
      per_page: 1,
    });
    const pr = prListResponse.data[0];
    if (pr != null) {
      return { remoteRepo, baseBranch: pr.base.ref };
    } else {
      // PRが見つからない場合はデフォルトブランチにフォールバックします。
      const baseBranch = await getDefaultBranch(octokit, remoteRepo);
      return { remoteRepo, baseBranch };
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw new Error(`failed to get base branch for current branch: ${err.message}`, { cause: err });
    }
    throw new Error("failed to get base branch for current branch", { cause: err });
  }
}

/**
 * ローカルレビューモードの変更セットを取得します。
 */
async function getLocalChangeset(octokit: Octokit): Promise<Changeset> {
  const { remoteRepo, baseBranch } = await getLocalBaseBranch(octokit);
  const range = `${remoteRepo.remoteName}/${baseBranch}...HEAD`;
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
  if (context.mode === "pr") {
    return getPrChangeset(octokit, context);
  }
  return getLocalChangeset(octokit);
}
