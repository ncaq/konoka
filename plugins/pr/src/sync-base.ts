import { CommandError, run, throwCommandError } from "./run.ts";

export interface SyncBaseResult {
  readonly currentBranch: string;
  readonly baseBranch: string;
  readonly owner: string;
  readonly repo: string;
  readonly rebased: boolean;
}

interface RepoInfo {
  readonly owner: string;
  readonly repo: string;
  readonly baseBranch: string;
}

function parseRepoInfo(json: string): RepoInfo {
  const value: unknown = JSON.parse(json);
  if (
    typeof value === "object" &&
    value !== null &&
    "owner" in value &&
    typeof value.owner === "object" &&
    value.owner !== null &&
    "login" in value.owner &&
    typeof value.owner.login === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "defaultBranchRef" in value &&
    typeof value.defaultBranchRef === "object" &&
    value.defaultBranchRef !== null &&
    "name" in value.defaultBranchRef &&
    typeof value.defaultBranchRef.name === "string"
  ) {
    return {
      owner: value.owner.login,
      repo: value.name,
      baseBranch: value.defaultBranchRef.name,
    };
  }
  throw new CommandError("Failed to parse gh repo view output.", json);
}

/**
 * baseブランチを最新化して、
 * 元のブランチに戻ってきます。
 */
async function pullBase(baseBranch: string, currentBranch: string): Promise<void> {
  try {
    await run("git", ["switch", baseBranch]);
    await run("git", ["pull", "--ff-only"]);
  } catch (err: unknown) {
    throwCommandError(`Failed to update base branch ${baseBranch}.`, err);
  } finally {
    // エラーが起きてもできるだけ元のブランチに戻るようにします。
    await run("git", ["switch", currentBranch]);
  }
}

/**
 * baseブランチを最新化して、
 * 必要に応じて現在のブランチをbaseの上にrebaseします。
 *
 * pushはこの関数では行いません。
 * upstreamの有無やrebaseの結果を踏まえたforce-with-leaseの判断は、
 * `pushHead`に委ねます。
 */
export async function syncBase(): Promise<SyncBaseResult> {
  const repoInfoJson = await run("gh", ["repo", "view", "--json", "owner,name,defaultBranchRef"]);
  const { owner, repo, baseBranch } = parseRepoInfo(repoInfoJson);
  const currentBranch = await run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);

  if (currentBranch === baseBranch) {
    throw new CommandError(`Current branch is the base branch ${baseBranch}.`, "");
  }

  const initialBaseSha = await run("git", ["rev-parse", baseBranch]);
  await pullBase(baseBranch, currentBranch);

  const newBaseSha = await run("git", ["rev-parse", baseBranch]);
  const rebased = initialBaseSha !== newBaseSha;
  if (rebased) {
    try {
      await run("git", ["rebase", baseBranch]);
    } catch (err: unknown) {
      // コンフリクト等でrebaseに失敗した場合、
      // 中断状態を残さないように`git rebase --abort`で巻き戻してから例外を再構築します。
      await run("git", ["rebase", "--abort"]);
      throwCommandError(`Failed to rebase ${currentBranch} onto ${baseBranch}.`, err);
    }
  }

  return { currentBranch, baseBranch, owner, repo, rebased };
}
