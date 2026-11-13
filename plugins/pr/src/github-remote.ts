import { Option } from "effect";

export interface GitHubRepository {
  readonly owner: string;
  readonly repo: string;
}

export interface Remote {
  readonly name: string;
  readonly url: string;
}

/**
 * remoteのURLの形式ごとに、
 * パス部分(`owner/repo`以降)を取り出す正規表現。
 */
const remoteUrlPatterns: readonly RegExp[] = [
  // https://github.com/owner/repo.git
  // ssh://git@github.com:22/owner/repo.git
  // git://github.com/owner/repo.git
  /^[a-z][a-z0-9+.-]*:\/\/[^/]+\/(?<path>.+)$/i,
  // git@github.com:owner/repo.git
  /^[^/:]+:(?<path>[^/].*)$/,
] as const;

/**
 * remoteのURLからGitHubリポジトリのowner/repoを取り出します。
 *
 * SSHの設定でhostに別名を付けていても一致するように、
 * hostは検証せずに`owner/repo`の部分だけを見ます。
 * 解釈できない形式の場合は`Option.none`を返します。
 */
export function parseGitHubRemoteUrl(url: string): Option.Option<GitHubRepository> {
  for (const pattern of remoteUrlPatterns) {
    const path = pattern.exec(url.trim())?.groups?.["path"];
    if (path == null) {
      continue;
    }
    const segments = path
      .replace(/\/+$/, "")
      .replace(/\.git$/, "")
      .split("/");
    const [owner, repo] = segments;
    if (segments.length !== 2 || owner == null || repo == null || owner === "" || repo === "") {
      return Option.none();
    }
    return Option.some({ owner, repo });
  }
  return Option.none();
}

function equalsIgnoreCase(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * 指定したGitHubリポジトリを指すremoteの名前を返します。
 * GitHubのowner名とリポジトリ名は大文字小文字を区別しないため、区別せずに比較します。
 */
export function findRemoteFor(
  remotes: readonly Remote[],
  target: GitHubRepository,
): Option.Option<string> {
  return Option.fromNullishOr(
    remotes.find((remote) =>
      Option.match(parseGitHubRemoteUrl(remote.url), {
        onNone: () => false,
        onSome: ({ owner, repo }) =>
          equalsIgnoreCase(owner, target.owner) && equalsIgnoreCase(repo, target.repo),
      }),
    )?.name,
  );
}

/**
 * PR作成APIの`head`に渡す値を組み立てます。
 *
 * push先のownerがbaseリポジトリのownerと異なる場合はforkからのPRなので、
 * GitHubの仕様に従って`<owner>:<branch>`の形にします。
 * push先のownerが分からない場合は従来通りブランチ名だけを返します。
 */
export function formatHead(
  currentBranch: string,
  baseOwner: string,
  pushOwner: Option.Option<string>,
): string {
  return Option.match(pushOwner, {
    onNone: () => currentBranch,
    onSome: (owner) =>
      equalsIgnoreCase(owner, baseOwner) ? currentBranch : `${owner}:${currentBranch}`,
  });
}
