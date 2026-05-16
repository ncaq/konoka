import type { CommandExecutor } from "@effect/platform/CommandExecutor";
import type { PlatformError } from "@effect/platform/Error";
import { Effect, type ParseResult } from "effect";
import {
  BehindUpstreamError,
  ExistingOpenPullRequestError,
  type PushHeadResult,
  RevListParseError,
  pushHead,
} from "./push-head";
import { CommandFailedError } from "./run";
import { CurrentIsBaseError, RebaseFailedError, type SyncBaseResult, syncBase } from "./sync-base";

/** `syncBase`と`pushHead`の結果を1つにまとめた型。 */
export type SyncAndPushResult = SyncBaseResult & PushHeadResult;

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
  | ParseResult.ParseError
  | CurrentIsBaseError
  | RebaseFailedError
  | BehindUpstreamError
  | ExistingOpenPullRequestError,
  CommandExecutor
> {
  return Effect.gen(function* () {
    const sync = yield* syncBase();
    const push = yield* pushHead();
    return { ...sync, action: push.action };
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
    "",
  ].join("\n");
}
