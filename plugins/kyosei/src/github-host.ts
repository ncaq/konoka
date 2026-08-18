/**
 * GitHubの対象ホストを環境変数から決定するモジュール。
 *
 * kyoseiはGitHub Actions・GitHub CLI・GitHub Enterprise Serverなど、
 * 様々な環境で動くため、
 * どこのGitHubを相手にしているかは複数の環境変数から推定する必要があります。
 * APIクライアントの生成とレビューメタデータのリンク生成の両方が同じ推定を必要とするため、
 * 推定のロジックをこのモジュールへ集約して、
 * 両者が違うホストを指してしまう事故を防ぎます。
 */

import process from "node:process";
import { Data, Effect, Option } from "effect";

/** 環境変数が未設定または事実上の空である場合の失敗。 */
export class EnvVarNotSet extends Data.TaggedError("EnvVarNotSet")<{ readonly name: string }> {}

/** 環境変数の値がURLとして解釈できない場合の失敗。 */
export class EnvVarInvalidUrl extends Data.TaggedError("EnvVarInvalidUrl")<{
  readonly name: string;
  readonly cause: unknown;
}> {}

/**
 * 値をtrimして空文字なら`Option.none`として扱います。
 */
export function normalizeEnvironmentVariable(x: string): Option.Option<string> {
  const normalized = x.trim();
  return normalized === "" ? Option.none() : Option.some(normalized);
}

/**
 * 指定した環境変数を取得し、
 * 事実上の空だったら`Option.none`として扱います。
 */
export function getNormalizedEnvironmentVariable(name: string): Option.Option<string> {
  return Option.fromNullable(process.env[name]).pipe(Option.flatMap(normalizeEnvironmentVariable));
}

/**
 * 指定した環境変数をURLとして取得します。
 * 未設定なら`EnvVarNotSet`、URLとして解釈できなければ`EnvVarInvalidUrl`で失敗します。
 */
export function getUrlEnvironmentVariable(
  name: string,
): Effect.Effect<URL, EnvVarNotSet | EnvVarInvalidUrl> {
  return Effect.gen(function* () {
    const value = getNormalizedEnvironmentVariable(name);
    if (Option.isNone(value)) {
      return yield* new EnvVarNotSet({ name });
    }
    return yield* Effect.try({
      try: () => new URL(value.value),
      // 環境変数の内部は機密情報がある可能性があるので、値を直接エラーメッセージに含めないようにしています。
      catch: (cause) => new EnvVarInvalidUrl({ name, cause }),
    });
  });
}

/**
 * GitHubの対象ホスト名を環境変数から決定します。
 * 未設定の環境変数は次の候補にフォールスルーし、特に設定されていない場合は標準の`github.com`を返します。
 * URLとして不正な値が設定されている場合は`EnvVarInvalidUrl`で失敗します。
 */
export function getGitHubHostname(): Effect.Effect<string, EnvVarInvalidUrl> {
  return getUrlEnvironmentVariable("GITHUB_SERVER_URL").pipe(
    Effect.map((url) => url.hostname),
    Effect.catchTag("EnvVarNotSet", () =>
      getUrlEnvironmentVariable("GITHUB_API_URL").pipe(Effect.map((url) => url.hostname)),
    ),
    Effect.catchTag("EnvVarNotSet", () =>
      Option.match(getNormalizedEnvironmentVariable("GH_HOST"), {
        onSome: (host) => Effect.succeed(host),
        onNone: () => Effect.succeed("github.com"),
      }),
    ),
  );
}
