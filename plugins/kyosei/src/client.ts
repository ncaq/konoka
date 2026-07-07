/**
 * GitHubへ認証してクライアントを生成するためのモジュール。
 */

import process from "node:process";
import { Command, type CommandExecutor } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { Data, Effect, Option } from "effect";
import { Octokit } from "octokit";

/** 環境変数が未設定または事実上の空である場合の失敗。 */
class EnvVarNotSet extends Data.TaggedError("EnvVarNotSet")<{ readonly name: string }> {}

/** 環境変数の値がURLとして解釈できない場合の失敗。 */
class EnvVarInvalidUrl extends Data.TaggedError("EnvVarInvalidUrl")<{
  readonly name: string;
  readonly cause: unknown;
}> {}

/** GitHub CLIからのトークン読み取りに失敗した場合の失敗。 */
class GhTokenReadError extends Data.TaggedError("GhTokenReadError")<{
  readonly cause: PlatformError;
}> {
  override get message(): string {
    return `failed to read GitHub token from gh: ${this.cause.message}`;
  }
}

/** GitHub CLIのトークン出力が事実上の空である場合の失敗。 */
class GhTokenEmpty extends Data.TaggedError("GhTokenEmpty") {
  override get message(): string {
    return "gh auth token output is empty or whitespace only";
  }
}

/** Octokitクライアントの生成に失敗した場合の失敗。 */
export class OctokitClientCreationError extends Data.TaggedError("OctokitClientCreationError")<{
  readonly cause: Error;
}> {
  override get message(): string {
    return `failed to create Octokit client: ${this.cause.message}`;
  }
}

/**
 * GitHubに認証するための情報。
 * `OctokitOptions`に似ていますが、
 * このプログラムで必要な部分だけのミニマルなインターフェースです。
 */
interface GitHubAuthOptions {
  /** トークンの取得元を表す文字列。環境変数名やghコマンドなど。 */
  readonly source: string;
  /** GitHubのトークン。 */
  readonly token: string;
}

/**
 * GitHubのトークンが置かれていることが典型的にありそうな環境変数名。
 * 順番はどれが正しいかあまり分からなかったので素直に辞書順に並べています。
 * どれかがヒットすればそれで問題ないと思うので、
 * 順番はあまり重要ではないと考えています。
 */
export const tokenEnvironmentVariableNameList = [
  "GH_ENTERPRISE_TOKEN",
  "GH_TOKEN",
  "GITHUB_API_TOKEN",
  "GITHUB_ENTERPRISE_TOKEN",
  "GITHUB_PAT",
  "GITHUB_PERSONAL_ACCESS_TOKEN",
  "GITHUB_TOKEN",
  "INPUT_GITHUB_TOKEN",
] as const;

/**
 * 値をtrimして空文字なら`Option.none`として扱います。
 */
function normalizeEnvironmentVariable(x: string): Option.Option<string> {
  const normalized = x.trim();
  return normalized === "" ? Option.none() : Option.some(normalized);
}

/**
 * 指定した環境変数を取得し、
 * 事実上の空だったら`Option.none`として扱います。
 */
function getNormalizedEnvironmentVariable(name: string): Option.Option<string> {
  return Option.fromNullable(process.env[name]).pipe(Option.flatMap(normalizeEnvironmentVariable));
}

/**
 * 指定した環境変数をURLとして取得します。
 * 未設定なら`EnvVarNotSet`、URLとして解釈できなければ`EnvVarInvalidUrl`で失敗します。
 */
function getUrlEnvironmentVariable(
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
function getGitHubHostname(): Effect.Effect<string, EnvVarInvalidUrl> {
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

/**
 * APIのbaseUrlを環境変数から決定します。
 * 候補をGITHUB_API_URL→GITHUB_SERVER_URL→GH_HOSTの順で試し、全て未設定なら`EnvVarNotSet`で失敗します。
 * URLとして不正な値の場合は`EnvVarInvalidUrl`で失敗します。
 */
function getGitHubBaseUrl(): Effect.Effect<URL, EnvVarNotSet | EnvVarInvalidUrl> {
  return getUrlEnvironmentVariable("GITHUB_API_URL").pipe(
    // 未設定ならGITHUB_SERVER_URL由来のbaseUrlを派生します。
    Effect.catchTag("EnvVarNotSet", () =>
      getUrlEnvironmentVariable("GITHUB_SERVER_URL").pipe(
        Effect.map((url) =>
          url.origin === "https://github.com"
            ? new URL("https://api.github.com")
            : new URL("/api/v3", url),
        ),
      ),
    ),
    // それも未設定ならGH_HOST由来のbaseUrlを派生します。
    Effect.catchTag("EnvVarNotSet", () =>
      Option.match(getNormalizedEnvironmentVariable("GH_HOST"), {
        onSome: (host) =>
          Effect.succeed(
            host === "github.com"
              ? new URL("https://api.github.com")
              : new URL("/api/v3", `https://${host}`),
          ),
        onNone: () => Effect.fail(new EnvVarNotSet({ name: "GH_HOST" })),
      }),
    ),
  );
}

/**
 * 既知の環境変数一覧からGitHubトークンを探して`GitHubAuthOptions`に加工します。
 */
function getGitHubAuthOptionsFromEnvironment(): Option.Option<GitHubAuthOptions> {
  // 並列問い合わせに出来ないこともないですが、
  // 過剰な最適化だと思いますし、
  // 実行の予測性を重視してシンプルにループを回しています。
  // 環境変数のルックアップを非同期にしても大したパフォーマンス改善にはならないと思います。
  for (const variableName of tokenEnvironmentVariableNameList) {
    const token = getNormalizedEnvironmentVariable(variableName);
    if (Option.isSome(token)) {
      return Option.some({ source: variableName, token: token.value });
    }
  }
  return Option.none();
}

/**
 * GitHub CLIの認証情報からGitHubトークンを生成します。
 * 生成できなかったりコマンド実行に失敗した場合は失敗を伝達します。
 */
function createGitHubAuthOptionsFromGh(): Effect.Effect<
  GitHubAuthOptions,
  EnvVarInvalidUrl | GhTokenReadError | GhTokenEmpty,
  CommandExecutor.CommandExecutor
> {
  return Effect.gen(function* () {
    const githubHostname = yield* getGitHubHostname();
    const argumentList =
      githubHostname === "github.com"
        ? ["auth", "token"]
        : ["auth", "token", "--hostname", githubHostname];
    const stdout = yield* Command.string(Command.make("gh", ...argumentList)).pipe(
      Effect.mapError((cause) => new GhTokenReadError({ cause })),
    );
    const token = normalizeEnvironmentVariable(stdout);
    if (Option.isNone(token)) {
      return yield* new GhTokenEmpty();
    }
    return {
      source: argumentList.join(" "),
      token: token.value,
    };
  });
}

/**
 * GitHubトークンを生成します。
 * まず環境変数経由を試して次にGitHub CLIの順で試行します。
 */
function createGitHubAuthOptions(): Effect.Effect<
  GitHubAuthOptions,
  EnvVarInvalidUrl | GhTokenReadError | GhTokenEmpty,
  CommandExecutor.CommandExecutor
> {
  return Option.match(getGitHubAuthOptionsFromEnvironment(), {
    onSome: (options) => Effect.succeed(options),
    onNone: () => createGitHubAuthOptionsFromGh(),
  });
}

/**
 * rate limitのハンドラ。
 * 最大2回までリトライします。
 */
function handleRateLimit(
  retryAfter: number,
  options: { method: string; url: string },
  octokit: { log: { warn: (message: string) => void } },
  retryCount: number,
): boolean {
  octokit.log.warn(
    `rate limit exhausted for ${options.method} ${options.url}, retry after ${retryAfter}s`,
  );
  return retryCount < 2;
}

/**
 * secondary rate limitのハンドラ。
 * 最大2回までリトライします。
 */
function handleSecondaryRateLimit(
  retryAfter: number,
  options: { method: string; url: string },
  octokit: { log: { warn: (message: string) => void } },
  retryCount: number,
): boolean {
  octokit.log.warn(
    `secondary rate limit for ${options.method} ${options.url}, retry after ${retryAfter}s`,
  );
  return retryCount < 2;
}

/**
 * 利用可能な認証情報からOctokitクライアントを生成します。
 * 生成できない場合は失敗を伝達します。
 * kyoseiは想定環境として、
 * GitHub Actionsや手元でのCLI環境など、
 * 様々な環境で動かすことを想定しているので、
 * 単一の環境変数に頼るようなシンプルな方法ではなく、
 * このような複雑な方法が必要でした。
 */
export function createOctokitClient(): Effect.Effect<
  Octokit,
  OctokitClientCreationError,
  CommandExecutor.CommandExecutor
> {
  return Effect.gen(function* () {
    const githubAuthOptions = yield* createGitHubAuthOptions();
    // baseUrlが設定されている場合はオプションに追加します。そうでない場合は空のオブジェクトを展開して何もしないようにします。
    // `URL.toString()`はパスが空の場合末尾スラッシュを付けます。
    // 例: `new URL("https://api.github.com").toString()` → `"https://api.github.com/"`
    // baseUrlとエンドポイントパスを結合する際、
    // 末尾スラッシュがあるとダブルスラッシュになり404エラーが発生するので、
    // 末尾のスラッシュがあれば削除してからOctokitに渡すようにしています。
    // baseUrlの環境変数が一切設定されていない場合(`EnvVarNotSet`)はOctokitのデフォルトに任せます。
    const githubBaseUrlOptions = yield* getGitHubBaseUrl().pipe(
      Effect.map((url) => ({ baseUrl: url.toString().replace(/\/+$/, "") })),
      Effect.catchTag("EnvVarNotSet", () => Effect.succeed({} as const)),
    );

    return new Octokit({
      auth: githubAuthOptions.token,
      ...githubBaseUrlOptions,
      userAgent: `kyosei (${githubAuthOptions.source})`,
      throttle: {
        onRateLimit: handleRateLimit,
        onSecondaryRateLimit: handleSecondaryRateLimit,
      },
      retry: { enabled: true },
    });
  }).pipe(Effect.mapError((cause) => new OctokitClientCreationError({ cause })));
}
