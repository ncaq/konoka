/**
 * 変更セットの取得を行うモジュール。
 * GitHub出力ではOctokit経由でGitHub APIから取得し、
 * ローカル出力ではcontextに解決済みのブランチ情報を使って
 * gitコマンドで差分を取得します。
 */

import { Command, type CommandExecutor } from "@effect/platform";
import { Effect } from "effect";
import type { Octokit } from "octokit";
import type { GitHubOutputContext, LocalOutputContext, ReviewContext } from "./context-type";

/**
 * レビュー対象の変更セット。
 * 差分とコミットログを含みます。
 */
export interface Changeset {
  readonly diff: string;
  readonly log: string;
  /** PRのheadコミットSHA。GitHub出力時のみ設定されます。 */
  readonly headCommitId?: string;
}

/**
 * GitHub出力向けの変更セットを取得します。
 * GitHub APIからdiff形式で差分を取得し、
 * コミット一覧もAPIから取得します。
 */
function getPrChangeset(
  octokit: Octokit,
  context: GitHubOutputContext,
): Effect.Effect<Changeset, Error> {
  return Effect.gen(function* () {
    const [diffResponse, allCommits] = yield* Effect.all(
      [
        Effect.tryPromise(() =>
          octokit.rest.pulls.get({
            owner: context.pr.owner,
            repo: context.pr.repo,
            pull_number: context.pr.prNumber,
            mediaType: { format: "diff" },
          }),
        ),
        Effect.tryPromise(() =>
          octokit.paginate(octokit.rest.pulls.listCommits, {
            owner: context.pr.owner,
            repo: context.pr.repo,
            pull_number: context.pr.prNumber,
            per_page: 100,
          }),
        ),
      ],
      { concurrency: "unbounded" },
    );
    const log = allCommits
      .map((c) => {
        // まず入ってないことはないと思うので雑なフォールバック値を設定しています。
        const authorName = c.commit.author?.name ?? "unknown-author-name";
        const authorDate = c.commit.author?.date ?? "unknown-author-date";
        return `commit ${c.sha}\nAuthor: ${authorName}\nDate: ${authorDate}\n\n    ${c.commit.message}\n`;
      })
      .join("\n");
    // mediaType diffを指定するとレスポンスが文字列になります。
    if (typeof diffResponse.data !== "string") {
      return yield* Effect.fail(new Error("unexpected response type for diff"));
    }
    // コミット一覧の最後のエントリからPRのheadコミットSHAを取得します。
    // GitHub APIの`pulls.listCommits`は時系列昇順(古い順)で返すため、
    // ページネーションで全件取得した配列の末尾がPRのheadコミットに相当します。
    // `pulls.get`にmediaType diffを指定するとレスポンスが文字列になりhead SHAが取れないため、
    // コミット一覧から取得しています。
    const lastCommit = allCommits.at(-1);
    return {
      diff: diffResponse.data,
      log,
      ...(lastCommit != null ? { headCommitId: lastCommit.sha } : {}),
    };
  });
}

/**
 * ローカル出力向けの変更セットを取得します。
 * contextのbaseBranchとremoteNameからdiffとlogを生成します。
 */
function getLocalChangeset(
  context: LocalOutputContext,
): Effect.Effect<Changeset, Error, CommandExecutor.CommandExecutor> {
  return Effect.gen(function* () {
    const base =
      context.remoteName != null
        ? `${context.remoteName}/${context.baseBranch}`
        : context.baseBranch;
    const range = `${base}...HEAD`;
    const [diff, log] = yield* Effect.all(
      [
        Command.string(Command.make("git", "diff", "--end-of-options", range)),
        Command.string(Command.make("git", "log", "--end-of-options", range)),
      ],
      { concurrency: "unbounded" },
    );
    return { diff, log };
  });
}

/**
 * レビューコンテキストに応じて変更セットを取得します。
 */
export function getChangeset(
  octokit: Octokit,
  context: ReviewContext,
): Effect.Effect<Changeset, Error, CommandExecutor.CommandExecutor> {
  if (context.output === "github") {
    return getPrChangeset(octokit, context);
  }
  return getLocalChangeset(context);
}
