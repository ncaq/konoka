/**
 * Gitリモートからリポジトリ情報を取得するモジュール。
 */

import gitUrlParse from "git-url-parse";
import { execFileAsync } from "./exec.js";

/**
 * リモートリポジトリの情報。
 * リモート名、所有者、リポジトリ名を含みます。
 */
export interface RemoteRepo {
  /** gitのリモート名。通常はoriginですが他の名前の場合もあります。 */
  readonly remoteName: string;
  readonly owner: string;
  readonly repo: string;
}

/**
 * 現在のブランチのupstream設定からリモート名を取得します。
 * upstreamが設定されていない場合はgit remoteの先頭を使います。
 */
async function getRemoteName(): Promise<string> {
  try {
    // 現在のブランチのupstreamからリモート名を取得します。
    // 例: @{upstream}が"origin/main"ならリモート名は"origin"です。
    const upstreamRemoteOutput = await execFileAsync("git", [
      "rev-parse",
      "--abbrev-ref",
      "--symbolic-full-name",
      "@{upstream}",
    ]);
    // "origin/main"から"origin"を取得します。
    const upstream = upstreamRemoteOutput.stdout.trim();
    const separatorIndex = upstream.indexOf("/");
    if (separatorIndex > 0) {
      return upstream.slice(0, separatorIndex);
    }
  } catch (err: unknown) {
    // upstreamが設定されていない場合にgit rev-parseがExecFileExceptionをスローするのは想定通りです。
    if (err instanceof Error && "cmd" in err) {
      // gitコマンドの非ゼロ終了コードなのでgit remoteの先頭にフォールバックします。
    } else {
      throw err;
    }
  }
  const remoteListOutput = await execFileAsync("git", ["remote"]);
  const firstRemote = remoteListOutput.stdout.trim().split("\n")[0];
  if (firstRemote == null || firstRemote === "") {
    throw new Error("no git remotes configured");
  }
  return firstRemote;
}

/**
 * 現在のブランチに関連するリモートのリポジトリ情報を取得します。
 */
export async function getRemoteRepo(): Promise<RemoteRepo> {
  const remoteName = await getRemoteName();
  const remoteUrlOutput = await execFileAsync("git", ["remote", "get-url", remoteName]);
  const parsed = gitUrlParse(remoteUrlOutput.stdout.trim());
  if (parsed.owner === "" || parsed.name === "") {
    throw new Error(`failed to parse remote URL: ${remoteUrlOutput.stdout.trim()}`);
  }
  return { remoteName, owner: parsed.owner, repo: parsed.name };
}
