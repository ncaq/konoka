/**
 * ローカル出力コンテキストの解決モジュール。
 * gitとGitHub APIからブランチ情報を解決します。
 */

import { Command, type CommandExecutor } from "@effect/platform";
import { Data, Effect, Option } from "effect";
import type { Octokit } from "octokit";
import type { LocalOutputContext } from "./context-type";
import { getRemoteName, getRemoteRepo, type RemoteRepo } from "./remote";

/** `git symbolic-ref`の出力が想定形式でない場合の失敗。 */
class UnexpectedSymbolicRefFormat extends Data.TaggedError("UnexpectedSymbolicRefFormat")<{
  readonly ref: string;
}> {
  override get message(): string {
    return `unexpected symbolic-ref format: ${this.ref}`;
  }
}

/**
 * gitのsymbolic-refからリモートのデフォルトブランチ名を取得します。
 * `git remote set-head`で設定されている必要があります。
 */
function getDefaultBranchFromGit(
  remoteName: string,
): Effect.Effect<string, Error, CommandExecutor.CommandExecutor> {
  return Effect.gen(function* () {
    const symbolicRef = yield* Command.string(
      Command.make("git", "symbolic-ref", `refs/remotes/${remoteName}/HEAD`),
    );
    // "refs/remotes/origin/main" → "main"
    const prefix = `refs/remotes/${remoteName}/`;
    const ref = symbolicRef.trim();
    if (!ref.startsWith(prefix)) {
      return yield* new UnexpectedSymbolicRefFormat({ ref });
    }
    return ref.slice(prefix.length);
  });
}

/**
 * リモートURLからGitHubリポジトリ情報の取得を試みます。
 * リモート未設定やURL解析失敗は`Option.none`で表現し、それ以外のエラーはそのまま伝播します。
 * リモート名は呼び出し側で解決済みの値を渡し、git呼び出しの重複を避けます。
 */
function tryGetRemoteRepo(
  remoteName: string,
): Effect.Effect<Option.Option<RemoteRepo>, Error, CommandExecutor.CommandExecutor> {
  return getRemoteRepo(remoteName).pipe(
    Effect.map(Option.some),
    // GitHubリポジトリが特定できない正当なケースは`None`に畳んで上位に渡します。
    Effect.catchTags({
      NoGitRemotes: () => Effect.succeed(Option.none<RemoteRepo>()),
      RemoteUrlParseError: () => Effect.succeed(Option.none<RemoteRepo>()),
    }),
  );
}

/**
 * ローカル出力向けにブランチ情報を解決します。
 * GitHubリポジトリが存在する場合はAPIからPRのベースブランチまたはデフォルトブランチを取得します。
 * GitHubリポジトリが存在しない場合はgitのsymbolic-refからデフォルトブランチを取得します。
 * トークンやAPIの応答エラーはそのまま失敗として伝播します。
 */
export function resolveLocalContext(
  octokit: Octokit,
): Effect.Effect<LocalOutputContext, Error, CommandExecutor.CommandExecutor> {
  return Effect.gen(function* () {
    const [remoteName, currentBranchOutput] = yield* Effect.all(
      [getRemoteName(), Command.string(Command.make("git", "rev-parse", "--abbrev-ref", "HEAD"))],
      { concurrency: "unbounded" },
    );
    const currentBranch = currentBranchOutput.trim();
    const remoteRepo = yield* tryGetRemoteRepo(remoteName);
    if (Option.isNone(remoteRepo)) {
      // GitHubリポジトリが特定できない場合はgitからデフォルトブランチを取得します。
      const baseBranch = yield* getDefaultBranchFromGit(remoteName);
      return { output: "local", baseBranch, remoteName };
    }
    const repo = remoteRepo.value;
    const prListResponse = yield* Effect.tryPromise(() =>
      octokit.rest.pulls.list({
        owner: repo.owner,
        repo: repo.repo,
        head: `${repo.owner}:${currentBranch}`,
        state: "open",
        per_page: 1,
      }),
    );
    const pr = prListResponse.data[0];
    if (pr != null) {
      return {
        output: "local",
        pr: { owner: repo.owner, repo: repo.repo, prNumber: pr.number },
        baseBranch: pr.base.ref,
        remoteName,
      };
    }
    // PRが見つからない場合はデフォルトブランチにフォールバックします。
    const repoResponse = yield* Effect.tryPromise(() =>
      octokit.rest.repos.get({
        owner: repo.owner,
        repo: repo.repo,
      }),
    );
    return { output: "local", baseBranch: repoResponse.data.default_branch, remoteName };
  });
}
