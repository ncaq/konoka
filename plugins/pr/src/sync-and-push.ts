import { type PushHeadResult, pushHead } from "./push-head.ts";
import { type SyncBaseResult, syncBase } from "./sync-base.ts";

/**
 * `syncBase`と`pushHead`の結果を1つにまとめた型。
 */
export type SyncAndPushResult = SyncBaseResult & PushHeadResult;

/**
 * baseブランチの同期(rebase含む)に続けてremoteへのpushを実行します。
 *
 * 後段の`pushHead`は前段の`syncBase`の結果(rebase有無)に依存し、
 * かつ両方ともエラー時はPR作成スキルを終了するという挙動が共通しているため、
 * 1本のエントリーポイントにまとめます。
 */
export async function syncAndPush(): Promise<SyncAndPushResult> {
  const sync = await syncBase();
  const push = await pushHead({ currentBranch: sync.currentBranch });
  return { ...sync, action: push.action };
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
