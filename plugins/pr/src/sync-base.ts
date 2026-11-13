import { Data, Effect, Option, Schema, SchemaTransformation } from "effect";
import type { PlatformError } from "effect/PlatformError";
import type { ChildProcessSpawner } from "effect/process";
import { type Remote, findRemotesFor, formatRemote, parseRemoteList } from "./github-remote";
import { CommandFailedError, runStdout, tryRunStdout } from "./run";

export interface SyncBaseResult {
  readonly currentBranch: string;
  readonly baseBranch: string;
  /** 最新化したbaseブランチを指すremote追跡ブランチの参照名。 */
  readonly baseRef: string;
  readonly owner: string;
  readonly repo: string;
  readonly rebased: boolean;
}

/**
 * `gh repo view --json owner,name,defaultBranchRef`の出力スキーマ。
 *
 * JSON文字列を受け取り、必要なフィールドだけを抽出した整形済みの`RepoInfo`へ変換します。
 * `Schema.decodeTo`でフィールド名の付け替えとネスト解決も一気に行います。
 */
const RepoInfoFromJson = Schema.fromJsonString(
  Schema.Struct({
    owner: Schema.Struct({ login: Schema.String }),
    name: Schema.String,
    defaultBranchRef: Schema.Struct({ name: Schema.String }),
  }),
).pipe(
  Schema.decodeTo(
    Schema.Struct({
      owner: Schema.String,
      repo: Schema.String,
      defaultBranch: Schema.String,
    }),
    SchemaTransformation.transform({
      decode: (raw) => ({
        owner: raw.owner.login,
        repo: raw.name,
        defaultBranch: raw.defaultBranchRef.name,
      }),
      encode: (info) => ({
        owner: { login: info.owner },
        name: info.repo,
        defaultBranchRef: { name: info.defaultBranch },
      }),
    }),
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

/** baseブランチとして指定された名前がブランチ名として不正な場合に投げます。 */
export class InvalidBaseBranchError extends Data.TaggedError("InvalidBaseBranchError")<{
  readonly baseBranch: string;
}> {
  override get message(): string {
    return `Invalid base branch name: ${this.baseBranch}`;
  }
}

/** baseリポジトリを指すremoteが見つからない場合に投げます。 */
export class BaseRemoteNotFoundError extends Data.TaggedError("BaseRemoteNotFoundError")<{
  readonly owner: string;
  readonly repo: string;
  readonly remotes: readonly Remote[];
}> {
  override get message(): string {
    const remotes = this.remotes.map(formatRemote);
    return [
      `No git remote points to ${this.owner}/${this.repo}.`,
      "Add a remote for the base repository and retry.",
      "Current remotes:",
      ...(remotes.length === 0 ? ["(none)"] : remotes),
    ].join("\n");
  }
}

/** baseリポジトリを指すremoteが複数あり、どれからfetchするか決められない場合に投げます。 */
export class AmbiguousBaseRemoteError extends Data.TaggedError("AmbiguousBaseRemoteError")<{
  readonly owner: string;
  readonly repo: string;
  readonly candidates: readonly Remote[];
}> {
  override get message(): string {
    return [
      `Multiple git remotes point to ${this.owner}/${this.repo}.`,
      "Keep only one remote for the base repository and retry.",
      "Candidate remotes:",
      ...this.candidates.map(formatRemote),
    ].join("\n");
  }
}

/**
 * `gh repo view`が返したJSONをデコードして`RepoInfo`を返します。
 *
 * 検証とデコードを`Schema`に委ねるため、失敗時のエラー型は`Schema.SchemaError`になります。
 */
export function parseRepoInfo(json: string): Effect.Effect<RepoInfo, Schema.SchemaError> {
  return Schema.decodeUnknownEffect(RepoInfoFromJson)(json);
}

/** 登録されているremoteの名前とURLを列挙します。 */
function listRemotes(): Effect.Effect<
  readonly Remote[],
  CommandFailedError | PlatformError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  // `git remote -v`は`insteadOf`を展開したURLを表示するため、
  // `git config`で生の値を読むよりも実際の接続先に近い値で比較できます。
  // remoteごとに`git remote get-url`を起動せず、1回の起動で全てのremoteを取得します。
  return runStdout("git", ["remote", "-v"]).pipe(Effect.map(parseRemoteList));
}

/**
 * baseブランチをremoteから取得し、remote追跡ブランチの参照名を返します。
 *
 * forkから上流へPRを出す場合はローカルにbaseブランチが無いことが多く、
 * baseブランチが別のworktreeでcheckoutされていることもあるため、
 * ローカルブランチには触らずremote追跡ブランチだけを更新します。
 * remoteのfetch refspecが一部のブランチに絞られていても取得できるように、
 * refspecは明示します。
 */
function fetchBase(
  remote: string,
  baseBranch: string,
): Effect.Effect<
  string,
  CommandFailedError | PlatformError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  return Effect.gen(function* () {
    const baseRef = `refs/remotes/${remote}/${baseBranch}`;
    yield* runStdout("git", ["fetch", "--", remote, `+refs/heads/${baseBranch}:${baseRef}`]);
    return baseRef;
  });
}

/**
 * baseブランチを最新化して、必要に応じて現在のブランチをbaseの上にrebaseします。
 *
 * `baseOverride`が無い場合はリポジトリのデフォルトブランチをbaseにします。
 *
 * pushはこの関数では行いません。
 * upstreamの有無やrebaseの結果を踏まえたforce-with-leaseの判断は、
 * `pushHead`に委ねます。
 */
export function syncBase(
  baseOverride: Option.Option<string>,
): Effect.Effect<
  SyncBaseResult,
  | CommandFailedError
  | PlatformError
  | Schema.SchemaError
  | CurrentIsBaseError
  | InvalidBaseBranchError
  | BaseRemoteNotFoundError
  | AmbiguousBaseRemoteError
  | RebaseFailedError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  return Effect.gen(function* () {
    const repoInfoJson = yield* runStdout("gh", [
      "repo",
      "view",
      "--json",
      "owner,name,defaultBranchRef",
    ]);
    const { owner, repo, defaultBranch } = yield* parseRepoInfo(repoInfoJson);
    const baseBranch = Option.getOrElse(baseOverride, () => defaultBranch);
    const currentBranch = yield* runStdout("git", ["rev-parse", "--abbrev-ref", "HEAD"]);

    // `--branch`を付けると`@{-1}`などを展開してしまうため、
    // `refs/heads/`を前置した完全な参照名として検証します。
    const validBranchName = yield* tryRunStdout("git", [
      "check-ref-format",
      `refs/heads/${baseBranch}`,
    ]);
    if (Option.isNone(validBranchName)) {
      return yield* new InvalidBaseBranchError({ baseBranch });
    }

    if (currentBranch === baseBranch) {
      return yield* new CurrentIsBaseError({ baseBranch });
    }

    const remotes = yield* listRemotes();
    // hostを比較しないため、同じパスを持つ別ホストのmirrorも一致し得ます。
    // 取り違えたremoteからfetchしてrebaseやpushまで進まないように、複数一致はエラーにします。
    const [baseRemote, ...otherRemotes] = findRemotesFor(remotes, { owner, repo });
    if (baseRemote == null) {
      return yield* new BaseRemoteNotFoundError({ owner, repo, remotes });
    }
    if (otherRemotes.length > 0) {
      return yield* new AmbiguousBaseRemoteError({
        owner,
        repo,
        candidates: [baseRemote, ...otherRemotes],
      });
    }
    const baseRef = yield* fetchBase(baseRemote.name, baseBranch);

    // baseの先端が既に現在のブランチに含まれていればrebaseは不要です。
    // `--is-ancestor`は含まれない場合に非0で終了します。
    const upToDate = yield* tryRunStdout("git", [
      "merge-base",
      "--is-ancestor",
      "--end-of-options",
      baseRef,
      "HEAD",
    ]);
    const rebased = Option.isNone(upToDate);
    if (rebased) {
      yield* runStdout("git", ["rebase", "--", baseRef]).pipe(
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

    return { currentBranch, baseBranch, baseRef, owner, repo, rebased };
  });
}
