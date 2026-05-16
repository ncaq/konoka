import type { CommandExecutor } from "@effect/platform/CommandExecutor";
import type { PlatformError } from "@effect/platform/Error";
import { Data, Effect, Option, ParseResult, Schema } from "effect";
import { CommandFailedError, runStdout, tryRunStdout } from "./run";

/** `pushHead`が取り得る動作の種類。 */
export type PushAction = "none" | "initial" | "normal" | "force";

export interface PushHeadResult {
  readonly currentBranch: string;
  readonly action: PushAction;
}

interface AheadBehind {
  readonly behind: number;
  readonly ahead: number;
}

/** `git rev-list --left-right --count`の出力パース失敗を表すロジックエラー。 */
export class RevListParseError extends Data.TaggedError("RevListParseError")<{
  readonly message: string;
}> {}

/** ローカルがupstreamより遅れている異常状態を表します。 */
export class BehindUpstreamError extends Data.TaggedError("BehindUpstreamError")<{
  readonly behind: number;
}> {
  override get message(): string {
    return (
      `Local branch is behind upstream by ${String(this.behind)} commit(s).` +
      ` Pull or rebase before retry.`
    );
  }
}

/** 同名ブランチに既に開いているPRがあったためforce pushを拒否したことを表します。 */
export class ExistingOpenPullRequestError extends Data.TaggedError("ExistingOpenPullRequestError")<{
  readonly branch: string;
  readonly number: number;
}> {
  override get message(): string {
    return [
      `An open pull request #${String(this.number)}`,
      `already exists for branch ${this.branch}.`,
      "Cancel this skill and update the existing PR instead of force-pushing.",
    ].join(" ");
  }
}

export function parseAheadBehind(out: string): Effect.Effect<AheadBehind, RevListParseError> {
  function isNonNegativeInteger(x: unknown): boolean {
    return typeof x === "number" && Number.isInteger(x) && 0 <= x;
  }

  const parts = out.split(/\s+/);
  if (parts.length < 2) {
    return Effect.fail(
      new RevListParseError({ message: `Failed to parse rev-list output: ${out}` }),
    );
  }
  const behind = Number(parts[0]);
  const ahead = Number(parts[1]);
  if (!isNonNegativeInteger(behind) || !isNonNegativeInteger(ahead)) {
    return Effect.fail(
      new RevListParseError({ message: `Failed to parse rev-list output: ${out}` }),
    );
  }
  return Effect.succeed({ behind, ahead });
}

/** `gh pr list --json number`の出力スキーマ。 */
const OpenPrSchema = Schema.Struct({ number: Schema.Number });

/** 上記の配列形式から先頭1件を取り出すスキーマ。JSON文字列を直接デコードします。 */
const OpenPrListFromJson = Schema.parseJson(Schema.Array(OpenPrSchema));

type OpenPr = Schema.Schema.Type<typeof OpenPrSchema>;

/**
 * `gh pr list --json number`が返したJSONをデコードし、
 * 先頭の1件を`Option`で返します。
 *
 * 検証とデコードを`Schema.parseJson` + `Schema.decodeUnknown`に委ねるため、
 * 失敗時のエラー型は`ParseResult.ParseError`になります。
 */
export function parseOpenPr(
  json: string,
): Effect.Effect<Option.Option<OpenPr>, ParseResult.ParseError> {
  return Schema.decodeUnknown(OpenPrListFromJson)(json).pipe(
    Effect.map((entries) => Option.fromNullable(entries[0])),
  );
}

/**
 * カレントブランチ名で開いているPRを返します。
 * ない場合は`Option.none`。
 * fork経由で同名ブランチからPRが作成されているケースは検知できません。
 */
function findOpenPullRequest(
  branch: string,
): Effect.Effect<
  Option.Option<OpenPr>,
  CommandFailedError | PlatformError | ParseResult.ParseError,
  CommandExecutor
> {
  return Effect.gen(function* () {
    const json = yield* runStdout("gh", [
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
    return yield* parseOpenPr(json);
  });
}

/**
 * upstreamの状態とローカルとの関係から取るべきpushの種類を判定します。
 *
 * - upstream未設定: `initial`(`git push -u`)
 * - 完全一致: `none`(pushは不要)
 * - ローカルのみ先行: `normal`(通常push)
 * - 履歴が分岐(ahead && behind): `force`(force-with-leaseが必要)
 * - リモートのみ先行: 異常状態として`BehindUpstreamError`で失敗
 */
function detectAction(): Effect.Effect<
  PushAction,
  CommandFailedError | PlatformError | RevListParseError | BehindUpstreamError,
  CommandExecutor
> {
  return Effect.gen(function* () {
    const upstream = yield* tryRunStdout("git", [
      "rev-parse",
      "--abbrev-ref",
      "--symbolic-full-name",
      "@{u}",
    ]);
    if (Option.isNone(upstream)) {
      return "initial" as const;
    }
    const aheadBehind = yield* parseAheadBehind(
      yield* runStdout("git", ["rev-list", "--left-right", "--count", "@{u}...HEAD"]),
    );
    if (aheadBehind.behind === 0 && aheadBehind.ahead === 0) {
      return "none" as const;
    }
    if (aheadBehind.behind === 0 && aheadBehind.ahead > 0) {
      return "normal" as const;
    }
    if (aheadBehind.behind > 0 && aheadBehind.ahead === 0) {
      return yield* new BehindUpstreamError({ behind: aheadBehind.behind });
    }
    return "force" as const;
  });
}

/**
 * カレントブランチをremoteに同期するためのpushを実行します。
 *
 * `force`が必要な場合は事前に同名ブランチをheadとするopen PRが存在しないことを確認し、
 * 既に存在する場合はforce pushを行わずに`ExistingOpenPullRequestError`で失敗してスキルの中断を促します。
 */
export function pushHead(): Effect.Effect<
  PushHeadResult,
  | CommandFailedError
  | PlatformError
  | RevListParseError
  | ParseResult.ParseError
  | BehindUpstreamError
  | ExistingOpenPullRequestError,
  CommandExecutor
> {
  return Effect.gen(function* () {
    const remote = "origin";
    const currentBranch = yield* runStdout("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
    const action = yield* detectAction();

    switch (action) {
      case "none":
        return { currentBranch, action };
      case "initial":
        yield* runStdout("git", ["push", "-u", "--", remote, currentBranch]);
        return { currentBranch, action };
      case "normal":
        yield* runStdout("git", ["push", "--", remote, currentBranch]);
        return { currentBranch, action };
      case "force": {
        const openPr = yield* findOpenPullRequest(currentBranch);
        if (Option.isSome(openPr)) {
          return yield* new ExistingOpenPullRequestError({
            branch: currentBranch,
            number: openPr.value.number,
          });
        }
        yield* runStdout("git", ["push", "--force-with-lease", "--", remote, currentBranch]);
        return { currentBranch, action };
      }
    }
  });
}
