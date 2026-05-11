import { CommandError, run, tryRun } from "./run.ts";

/** push-head.tsが取り得る動作の種類。 */
export type PushAction = "none" | "initial" | "normal" | "force";

export interface PushHeadResult {
  readonly currentBranch: string;
  readonly action: PushAction;
}

interface AheadBehind {
  readonly behind: number;
  readonly ahead: number;
}

export function parseAheadBehind(out: string): AheadBehind {
  function isNonNegativeInteger(x: unknown): boolean {
    return typeof x === "number" && Number.isInteger(x) && 0 <= x;
  }

  const parts = out.split(/\s+/);
  if (parts.length < 2) {
    throw new CommandError(`Failed to parse rev-list output: ${out}`, "");
  }
  const behind = Number(parts[0]);
  const ahead = Number(parts[1]);
  if (!isNonNegativeInteger(behind) || !isNonNegativeInteger(ahead)) {
    throw new CommandError(`Failed to parse rev-list output: ${out}`, "");
  }
  return { behind, ahead };
}

interface OpenPr {
  readonly number: number;
}

export function parseOpenPr(json: string): OpenPr | undefined {
  const value: unknown = JSON.parse(json);
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }
  const first: unknown = value[0];
  if (
    typeof first === "object" &&
    first !== null &&
    "number" in first &&
    typeof first.number === "number"
  ) {
    return { number: first.number };
  }
  throw new CommandError(`Failed to parse gh pr list output: ${json}`, "");
}

/**
 * カレントブランチ名で開いているPRを返します。
 * ない場合は`undefined`。
 * fork経由で同名ブランチからPRが作成されているケースは検知できません。
 */
async function findOpenPullRequest(branch: string): Promise<OpenPr | undefined> {
  const json = await run("gh", [
    "pr",
    "list",
    `--head=${branch}`,
    "--state",
    "open",
    "--json",
    "number",
    "--limit",
    "1",
  ]);
  return parseOpenPr(json);
}

/**
 * upstreamの状態とローカルとの関係から取るべきpushの種類を判定します。
 *
 * - upstream未設定: `initial`(`git push -u`)
 * - 完全一致: `none`(pushは不要)
 * - ローカルのみ先行: `normal`(通常push)
 * - 履歴が分岐(ahead && behind): `force`(force-with-leaseが必要)
 * - リモートのみ先行: 異常状態としてエラーを投げる
 */
async function detectAction(): Promise<PushAction> {
  const upstream = await tryRun("git", [
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{u}",
  ]);
  if (upstream === undefined) {
    return "initial";
  }
  const aheadBehind = parseAheadBehind(
    await run("git", ["rev-list", "--left-right", "--count", "@{u}...HEAD"]),
  );
  if (aheadBehind.behind === 0 && aheadBehind.ahead === 0) {
    return "none";
  }
  if (aheadBehind.behind === 0 && aheadBehind.ahead > 0) {
    return "normal";
  }
  if (aheadBehind.behind > 0 && aheadBehind.ahead === 0) {
    throw new CommandError(
      `Local branch is behind upstream by ${String(aheadBehind.behind)} commit(s).` +
        " Pull or rebase before retry.",
      "",
    );
  }
  return "force";
}

/**
 * カレントブランチをremoteに同期するためのpushを実行します。
 *
 * `force`が必要な場合は事前に同名ブランチをheadとするopen PRが存在しないことを確認し、
 * 既に存在する場合はforce pushを行わずにエラーを投げてスキルの中断を促します。
 */
export async function pushHead(): Promise<PushHeadResult> {
  const remote = "origin";
  const currentBranch = await run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);

  const action = await detectAction();

  switch (action) {
    case "none":
      return { currentBranch, action };
    case "initial":
      await run("git", ["push", "-u", "--", remote, currentBranch]);
      return { currentBranch, action };
    case "normal":
      await run("git", ["push", "--", remote, currentBranch]);
      return { currentBranch, action };
    case "force": {
      const openPr = await findOpenPullRequest(currentBranch);
      if (openPr !== undefined) {
        throw new CommandError(
          [
            `An open pull request #${String(openPr.number)}`,
            `already exists for branch ${currentBranch}.`,
            "Cancel this skill and update the existing PR instead of force-pushing.",
          ].join(" "),
          "",
        );
      }
      await run("git", ["push", "--force-with-lease", "--", remote, currentBranch]);
      return { currentBranch, action };
    }
  }
}
