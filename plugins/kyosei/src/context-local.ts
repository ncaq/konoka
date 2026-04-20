/**
 * ローカル出力コンテキストの解決モジュール。
 * gitとGitHub APIからブランチ情報を解決します。
 */

import type { Octokit } from "octokit";
import type { LocalOutputContext } from "./context-type.js";
import { execFileAsync } from "./exec.js";
import { getRemoteName, getRemoteRepo } from "./remote.js";

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
 * リモートURLからGitHubリポジトリ情報の取得を試みます。
 * URLが解析できない場合(GitHubリポジトリでない場合)はundefinedを返します。
 * それ以外のエラー(gitコマンド失敗等)はそのままthrowします。
 */
async function tryGetRemoteRepo(): Promise<Awaited<ReturnType<typeof getRemoteRepo>> | undefined> {
  try {
    return await getRemoteRepo();
  } catch (err: unknown) {
    // getRemoteRepoがthrowするのはURL解析失敗("failed to parse remote URL")か
    // リモート未設定("no git remotes configured")の場合です。
    // これらはGitHubリポジトリが存在しない正当なケースなのでundefinedを返します。
    if (err instanceof Error && err.message.startsWith("failed to parse remote URL")) {
      return undefined;
    }
    if (err instanceof Error && err.message === "no git remotes configured") {
      return undefined;
    }
    throw err;
  }
}

/**
 * ローカル出力向けにブランチ情報を解決します。
 * GitHubリポジトリが存在する場合はAPIからPRのベースブランチまたはデフォルトブランチを取得します。
 * GitHubリポジトリが存在しない場合はgitのsymbolic-refからデフォルトブランチを取得します。
 * トークンやAPIの応答エラーはそのままthrowします。
 */
export async function resolveLocalContext(octokit: Octokit): Promise<LocalOutputContext> {
  const [remoteName, currentBranchOutput] = await Promise.all([
    getRemoteName(),
    execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"]),
  ]);
  const currentBranch = currentBranchOutput.stdout.trim();
  const remoteRepo = await tryGetRemoteRepo();
  if (remoteRepo == null) {
    // GitHubリポジトリが特定できない場合はgitからデフォルトブランチを取得します。
    const baseBranch = await getDefaultBranchFromGit(remoteName);
    return { output: "local", baseBranch, remoteName };
  }
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
}
