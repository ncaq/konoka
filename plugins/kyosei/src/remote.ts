/**
 * Gitリモートからリポジトリ情報を取得するモジュール。
 */

import gitUrlParse from "git-url-parse";
import { execFileAsync } from "./exec.js";

/**
 * リモートリポジトリの所有者とリポジトリ名。
 */
export interface RemoteRepo {
  readonly owner: string;
  readonly repo: string;
}

/**
 * originリモートのURLからリポジトリ情報を取得します。
 */
export async function getRemoteRepo(): Promise<RemoteRepo> {
  const remoteUrlOutput = await execFileAsync("git", ["remote", "get-url", "origin"]);
  const parsed = gitUrlParse(remoteUrlOutput.stdout.trim());
  if (parsed.owner === "" || parsed.name === "") {
    throw new Error(`failed to parse remote URL: ${remoteUrlOutput.stdout.trim()}`);
  }
  return { owner: parsed.owner, repo: parsed.name };
}
