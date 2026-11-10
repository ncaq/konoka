import { Effect, type Schema } from "effect";
import type { PlatformError } from "effect/PlatformError";
import type { ChildProcessSpawner } from "effect/process";
import {
  BehindUpstreamError,
  ExistingOpenPullRequestError,
  type PushHeadResult,
  RevListParseError,
  pushHead,
} from "./push-head";
import { CommandFailedError, runStdout } from "./run";
import { CurrentIsBaseError, RebaseFailedError, type SyncBaseResult, syncBase } from "./sync-base";

/**
 * `syncBase`と`pushHead`の結果に、
 * PRに含まれるコミット数を加えた型。
 */
export type SyncAndPushResult = SyncBaseResult &
  PushHeadResult & {
    readonly commits: number;
  };

/** `git rev-list --count`の出力をコミット数として解釈します。 */
export function parseCommitCount(out: string): Effect.Effect<number, RevListParseError> {
  const trimmed = out.trim();
  const count = Number(trimmed);
  if (trimmed === "" || !Number.isInteger(count) || count < 0) {
    return Effect.fail(
      new RevListParseError({ message: `Failed to parse rev-list count output: ${out}` }),
    );
  }
  return Effect.succeed(count);
}

/**
 * baseブランチの同期(rebase含む)に続けてremoteへのpushを実行します。
 *
 * 後段の`pushHead`は前段の`syncBase`の結果(rebase有無)に依存し、
 * かつ両方ともエラー時はPR作成スキルを終了するという挙動が共通しているため、
 * 1本のエントリーポイントにまとめます。
 */
export function syncAndPush(): Effect.Effect<
  SyncAndPushResult,
  | CommandFailedError
  | PlatformError
  | RevListParseError
  | Schema.SchemaError
  | CurrentIsBaseError
  | RebaseFailedError
  | BehindUpstreamError
  | ExistingOpenPullRequestError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  return Effect.gen(function* () {
    const sync = yield* syncBase();
    const push = yield* pushHead();
    if (sync.currentBranch !== push.currentBranch) {
      yield* Effect.die("syncBase and pushHead returned results for different branches");
    }
    // baseは`syncBase`で最新化済みなので、
    // ローカルのbaseからの差分がそのままPRに含まれるコミットになります。
    const commits = yield* parseCommitCount(
      yield* runStdout("git", ["rev-list", "--count", `${sync.baseBranch}..HEAD`]),
    );
    return { ...sync, action: push.action, commits };
  });
}

export function formatSyncAndPush(result: SyncAndPushResult): string {
  return [
    `current=${result.currentBranch}`,
    `base=${result.baseBranch}`,
    `owner=${result.owner}`,
    `repo=${result.repo}`,
    `rebased=${String(result.rebased)}`,
    `action=${result.action}`,
    `commits=${String(result.commits)}`,
    "",
  ].join("\n");
}
