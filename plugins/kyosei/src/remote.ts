/**
 * Gitリモートからリポジトリ情報を取得するモジュール。
 */

import { Command, type CommandExecutor } from "@effect/platform";
import { Data, Effect, Option } from "effect";
import gitUrlParse from "git-url-parse";

/**
 * リモートリポジトリの情報。
 * リモート名、所有者、リポジトリ名を含みます。
 */
export interface RemoteRepo {
  /** gitのリモート名。通常はoriginですが他の名前の場合もあります。 */
  readonly remoteName: string;
  readonly owner: string;
  readonly repo: string;
}

/** gitリモートが1つも設定されていない場合の失敗。 */
export class NoGitRemotes extends Data.TaggedError("NoGitRemotes") {}

/** リモートURLがGitHub形式として解釈できない場合の失敗。 */
export class RemoteUrlParseError extends Data.TaggedError("RemoteUrlParseError")<{
  readonly url: string;
}> {}

/**
 * 現在のブランチのupstream設定からリモート名を取得します。
 * upstreamが設定されていない場合はgit remoteの先頭を使います。
 */
export function getRemoteName(): Effect.Effect<
  string,
  Error | NoGitRemotes,
  CommandExecutor.CommandExecutor
> {
  return Effect.gen(function* () {
    // 現在のブランチのupstreamからリモート名を取得します。
    // 例: @{upstream}が"origin/main"ならリモート名は"origin"です。
    // upstream未設定時の`git rev-parse`非ゼロ終了は想定通りなのでgit remoteのフォールバックに進めます。
    // ここでExitCodeError以外の失敗を区別したいが、Command.stringは現状PlatformError系をそのまま返すため、
    // 細かいタグ判別はせずgit remoteへフォールバックします。
    const fromUpstream = yield* Command.string(
      Command.make("git", "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"),
    ).pipe(
      Effect.map((stdout) => {
        const upstream = stdout.trim();
        const separatorIndex = upstream.indexOf("/");
        return separatorIndex > 0
          ? Option.some(upstream.slice(0, separatorIndex))
          : Option.none<string>();
      }),
      Effect.catchAll(() => Effect.succeed(Option.none<string>())),
    );
    if (Option.isSome(fromUpstream)) {
      return fromUpstream.value;
    }
    const remoteListOutput = yield* Command.string(Command.make("git", "remote"));
    const firstRemote = remoteListOutput.trim().split("\n")[0];
    if (firstRemote == null || firstRemote === "") {
      return yield* Effect.fail(new NoGitRemotes());
    }
    return firstRemote;
  });
}

/**
 * 現在のブランチに関連するリモートのリポジトリ情報を取得します。
 * リモートが未設定なら`NoGitRemotes`、URLが解釈できなければ`RemoteUrlParseError`で失敗します。
 */
export function getRemoteRepo(): Effect.Effect<
  RemoteRepo,
  Error | NoGitRemotes | RemoteUrlParseError,
  CommandExecutor.CommandExecutor
> {
  return Effect.gen(function* () {
    const remoteName = yield* getRemoteName();
    const remoteUrlOutput = yield* Command.string(
      Command.make("git", "remote", "get-url", remoteName),
    );
    const url = remoteUrlOutput.trim();
    const parsed = gitUrlParse(url);
    if (parsed.owner === "" || parsed.name === "") {
      return yield* Effect.fail(new RemoteUrlParseError({ url }));
    }
    return { remoteName, owner: parsed.owner, repo: parsed.name };
  });
}
