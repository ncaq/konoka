/**
 * カレントブランチからPRを探索するモジュール。
 *
 * kyoseiの複製元はdiff生成のためにベースブランチの解決まで行っていましたが、
 * misuzuはdiffを扱わないため、PRの特定だけに絞っています。
 */

import { Command, type CommandExecutor } from "@effect/platform";
import { Effect, Option } from "effect";
import type { Octokit } from "octokit";
import type { PrIdentifier } from "./context-type";
import { getRemoteName, getRemoteRepo, type RemoteRepo } from "./remote";

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
 * カレントブランチに紐付くopenなPRを探索します。
 * gitリモートが存在しない場合、GitHubリポジトリとして特定できない場合、
 * 対応するPRが存在しない場合は`Option.none`を返します。
 * トークンやAPIの応答エラーはそのまま失敗として伝播します。
 */
export function findPrForCurrentBranch(
  octokit: Octokit,
): Effect.Effect<Option.Option<PrIdentifier>, Error, CommandExecutor.CommandExecutor> {
  return Effect.gen(function* () {
    const [remoteName, currentBranchOutput] = yield* Effect.all(
      [
        // リモートが1つもないのはPRが特定できない正当なケースなのでNoneに畳みます。
        getRemoteName().pipe(
          Effect.map(Option.some),
          Effect.catchTag("NoGitRemotes", () => Effect.succeed(Option.none<string>())),
        ),
        Command.string(Command.make("git", "rev-parse", "--abbrev-ref", "HEAD")),
      ],
      { concurrency: "unbounded" },
    );
    if (Option.isNone(remoteName)) {
      return Option.none();
    }
    const currentBranch = currentBranchOutput.trim();
    const remoteRepo = yield* tryGetRemoteRepo(remoteName.value);
    if (Option.isNone(remoteRepo)) {
      return Option.none();
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
    return pr == null
      ? Option.none()
      : Option.some({ owner: repo.owner, repo: repo.repo, prNumber: pr.number });
  });
}
