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
 * ローカル出力向けにブランチ情報を解決します。
 * GitHub APIが利用可能なら、PRのベースブランチまたはリポジトリのデフォルトブランチを取得します。
 * GitHub APIが利用できない場合はgitのsymbolic-refからデフォルトブランチを取得します。
 */
export async function resolveLocalContext(octokit: Octokit): Promise<LocalOutputContext> {
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
