import type { CommandExecutor } from "@effect/platform/CommandExecutor";
import type { PlatformError } from "@effect/platform/Error";
import { Data, Effect, type ParseResult, Schema } from "effect";
import { CommandFailedError, runStdout } from "./run";

export interface SyncBaseResult {
  readonly currentBranch: string;
  readonly baseBranch: string;
  readonly owner: string;
  readonly repo: string;
  readonly rebased: boolean;
}

/**
 * `gh repo view --json owner,name,defaultBranchRef`の出力スキーマ。
 *
 * JSON文字列を受け取り、必要なフィールドだけを抽出した整形済みの`RepoInfo`へ変換します。
 * `Schema.transform`でフィールド名の付け替えとネスト解決も一気に行います。
 */
const RepoInfoFromJson = Schema.parseJson(
  Schema.Struct({
    owner: Schema.Struct({ login: Schema.String }),
    name: Schema.String,
    defaultBranchRef: Schema.Struct({ name: Schema.String }),
  }),
).pipe(
  Schema.transform(
    Schema.Struct({
      owner: Schema.String,
      repo: Schema.String,
      baseBranch: Schema.String,
    }),
    {
      strict: true,
      decode: (raw) => ({
        owner: raw.owner.login,
        repo: raw.name,
        baseBranch: raw.defaultBranchRef.name,
      }),
      encode: (info) => ({
        owner: { login: info.owner },
        name: info.repo,
        defaultBranchRef: { name: info.baseBranch },
      }),
    },
  ),
);

type RepoInfo = Schema.Schema.Type<typeof RepoInfoFromJson>;

/** カレントブランチがbaseブランチと同じ場合に投げます。 */
export class CurrentIsBaseError extends Data.TaggedError("CurrentIsBaseError")<{
  readonly baseBranch: string;
}> {
  override get message(): string {
    return `Current branch is the base branch ${this.baseBranch}.`;
  }
}

/** rebaseが失敗してabortで巻き戻したことを表します。 */
export class RebaseFailedError extends Data.TaggedError("RebaseFailedError")<{
  readonly currentBranch: string;
  readonly baseBranch: string;
  readonly cause: CommandFailedError | PlatformError;
}> {
  override get message(): string {
    return `Failed to rebase ${this.currentBranch} onto ${this.baseBranch}.\n${this.cause.message}`;
  }
}

/**
 * `gh repo view`が返したJSONをデコードして`RepoInfo`を返します。
 *
 * 検証とデコードを`Schema`に委ねるため、失敗時のエラー型は`ParseResult.ParseError`になります。
 */
export function parseRepoInfo(json: string): Effect.Effect<RepoInfo, ParseResult.ParseError> {
  return Schema.decodeUnknown(RepoInfoFromJson)(json);
}

/**
 * baseブランチを最新化して、元のブランチに戻ります。
 *
 * `git pull`に失敗してもできるだけ元のブランチに戻るため、
 * `Effect.ensuring`で`git switch`をfinally相当として実行します。
 */
function pullBase(
  baseBranch: string,
  currentBranch: string,
): Effect.Effect<void, CommandFailedError | PlatformError, CommandExecutor> {
  return Effect.gen(function* () {
    yield* runStdout("git", ["switch", "--", baseBranch]);
    yield* runStdout("git", ["pull", "--ff-only"]);
  }).pipe(Effect.ensuring(Effect.ignore(runStdout("git", ["switch", "--", currentBranch]))));
}

/**
 * baseブランチを最新化して、必要に応じて現在のブランチをbaseの上にrebaseします。
 *
 * pushはこの関数では行いません。
 * upstreamの有無やrebaseの結果を踏まえたforce-with-leaseの判断は、
 * `pushHead`に委ねます。
 */
export function syncBase(): Effect.Effect<
  SyncBaseResult,
  | CommandFailedError
  | PlatformError
  | ParseResult.ParseError
  | CurrentIsBaseError
  | RebaseFailedError,
  CommandExecutor
> {
  return Effect.gen(function* () {
    const repoInfoJson = yield* runStdout("gh", [
      "repo",
      "view",
      "--json",
      "owner,name,defaultBranchRef",
    ]);
    const { owner, repo, baseBranch } = yield* parseRepoInfo(repoInfoJson);
    const currentBranch = yield* runStdout("git", ["rev-parse", "--abbrev-ref", "HEAD"]);

    if (currentBranch === baseBranch) {
      return yield* new CurrentIsBaseError({ baseBranch });
    }

    const initialBaseSha = yield* runStdout("git", ["rev-parse", "--end-of-options", baseBranch]);
    yield* pullBase(baseBranch, currentBranch);

    const newBaseSha = yield* runStdout("git", ["rev-parse", "--end-of-options", baseBranch]);
    const rebased = initialBaseSha !== newBaseSha;
    if (rebased) {
      yield* runStdout("git", ["rebase", "--", baseBranch]).pipe(
        Effect.catchTags({
          CommandFailedError: (err) =>
            Effect.gen(function* () {
              // コンフリクト等でrebaseに失敗した場合、
              // 中断状態を残さないように`git rebase --abort`で巻き戻してから例外を再構築します。
              yield* runStdout("git", ["rebase", "--abort"]);
              return yield* new RebaseFailedError({ currentBranch, baseBranch, cause: err });
            }),
        }),
      );
    }

    return { currentBranch, baseBranch, owner, repo, rebased };
  });
}
