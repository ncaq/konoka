/**
 * Gitリモートからリポジトリ情報を取得するモジュール。
 */

import { execFileAsync } from "./exec.js";
import { remoteUrlPatterns } from "./pattern.js";

/**
 * リモートリポジトリの所有者とリポジトリ名。
 */
export interface RemoteRepo {
  readonly owner: string;
  readonly repo: string;
}

/**
 * リモートURLからowner/repoを抽出します。
 * パースできない場合はundefinedを返します。
 */
function parseRemoteUrl(url: string): RemoteRepo | undefined {
  const trimmed = url.trim();
  for (const pattern of remoteUrlPatterns) {
    const match = pattern.exec(trimmed);
    if (match == null) {
      continue;
    }
    const owner = match[1];
    const repo = match[2];
    if (owner == null || repo == null) {
      continue;
    }
    return { owner, repo };
  }
  return undefined;
}

/**
 * originリモートのURLからリポジトリ情報を取得します。
 */
export async function getRemoteRepo(): Promise<RemoteRepo> {
  const remoteUrlOutput = await execFileAsync("git", ["remote", "get-url", "origin"]);
  const remoteUrl = remoteUrlOutput.stdout.trim();
  const remoteRepo = parseRemoteUrl(remoteUrl);
  if (remoteRepo == null) {
    throw new Error(`failed to parse remote URL: ${remoteUrl}`);
  }
  return remoteRepo;
}
