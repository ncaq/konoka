/**
 * GitHubへ認証してクライアントを生成するためのモジュール。
 */

import process from "node:process";
import { Octokit } from "octokit";
import { execFileAsync } from "./exec.js";

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
const tokenEnvironmentVariableNameList = [
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
 * 値をtrimして空文字なら無として扱います。
 */
function normalizeEnvironmentVariable(x: string): string | undefined {
  const normalized = x.trim();
  return normalized === "" ? undefined : normalized;
}

/**
 * 指定した環境変数を取得し、
 * 事実上の空だったら未設定として扱います。
 */
function getNormalizedEnvironmentVariable(name: string): string | undefined {
  const value = process.env[name];
  if (value == null) {
    return undefined;
  }
  return normalizeEnvironmentVariable(value);
}

/**
 * 指定した環境変数をURLとして取得します。
 */
function getUrlEnvironmentVariable(name: string): URL | undefined {
  const value = getNormalizedEnvironmentVariable(name);
  if (value == null) {
    return undefined;
  }
  // URLとして解釈できない値が環境変数に入っている時は変なことが置きていそうなので、
  // 素直にURLコンストラクタに任せて例外をそのままスローさせます。
  // 他のコードでも同様です。
  return new URL(value);
}

/**
 * GitHubの対象ホスト名を環境変数から決定します。
 * 特に設定されていない場合は標準の`github.com`を返します。
 */
function getGitHubHostname(): string {
  const githubServerUrl = getUrlEnvironmentVariable("GITHUB_SERVER_URL");

  if (githubServerUrl != null) {
    return githubServerUrl.hostname;
  }

  const githubApiUrl = getUrlEnvironmentVariable("GITHUB_API_URL");
  if (githubApiUrl != null) {
    return githubApiUrl.hostname;
  }

  const ghHost = getNormalizedEnvironmentVariable("GH_HOST");
  if (ghHost != null) {
    return ghHost;
  }

  return "github.com";
}

/**
 * APIのbaseUrlが設定されている場合は取得します。
 */
function getGitHubBaseUrl(): URL | undefined {
  // 直接指定されている場合はそのまま。
  const githubApiUrl = getUrlEnvironmentVariable("GITHUB_API_URL");
  if (githubApiUrl != null) {
    return githubApiUrl;
  }

  // URLやホストが指定されている場合は読み替えやサブディレクトリを追記します。
  const githubServerUrl = getUrlEnvironmentVariable("GITHUB_SERVER_URL");
  if (githubServerUrl != null) {
    if (githubServerUrl.origin === "https://github.com") {
      return new URL("https://api.github.com");
    }
    return new URL("/api/v3", githubServerUrl);
  }

  const ghHost = getNormalizedEnvironmentVariable("GH_HOST");
  if (ghHost != null) {
    if (ghHost === "github.com") {
      return new URL("https://api.github.com");
    }
    return new URL("/api/v3", `https://${ghHost}`);
  }

  return undefined;
}

/**
 * 既知の環境変数一覧からGitHubトークンを探して`GitHubAuthOptions`に加工します。
 */
function getGitHubAuthOptionsFromEnvironment(): GitHubAuthOptions | undefined {
  // Promiseに出来ないこともないですが、
  // 過剰な最適化だと思いますし、
  // 実行の予測性を重視してシンプルにループを回しています。
  // 環境変数のルックアップを非同期にしても大したパフォーマンス改善にはならないと思います。
  for (const variableName of tokenEnvironmentVariableNameList) {
    const token = getNormalizedEnvironmentVariable(variableName);
    if (token != null) {
      return {
        source: variableName,
        token,
      };
    }
  }
  return undefined;
}

/**
 * GitHub CLIの認証情報からGitHubトークンを生成します。
 * 生成できなかったりコマンド実行に失敗した場合は例外をスローします。
 */
async function createGitHubAuthOptionsFromGh(): Promise<GitHubAuthOptions> {
  const githubHostname = getGitHubHostname();
  const argumentList =
    githubHostname === "github.com" ? ["auth", "token"] : ["auth", "token", "--hostname", githubHostname];
  try {
    const ghAuthTokenOutput = await execFileAsync("gh", argumentList, {
      encoding: "utf8",
    });
    const token = normalizeEnvironmentVariable(ghAuthTokenOutput.stdout);
    if (token == null) {
      throw new Error("gh auth token output is empty or whitespace only");
    }
    return {
      source: argumentList.join(" "),
      token,
    };
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw new Error(`failed to read GitHub token from gh: ${err.message}`, { cause: err });
    }
    throw new Error("failed to read GitHub token from gh", { cause: err });
  }
}

/**
 * GitHubトークンを生成します。
 * まず環境変数経由を試して次にGitHub CLIの順で試行します。
 */
async function createGitHubAuthOptions(): Promise<GitHubAuthOptions> {
  const githubAuthOptionsFromEnvironment = getGitHubAuthOptionsFromEnvironment();
  if (githubAuthOptionsFromEnvironment != null) {
    return githubAuthOptionsFromEnvironment;
  }
  return createGitHubAuthOptionsFromGh(); // 例外が発生した場合はそのまま伝播します。
}

/**
 * 利用可能な認証情報からOctokitクライアントを生成します。
 * 生成できない場合は例外をスローします。
 * kyoseiは想定環境として、
 * GitHub Actionsや手元でのCLI環境など、
 * 様々な環境で動かすことを想定しているので、
 * 単一の環境変数に頼るようなシンプルな方法ではなく、
 * このような複雑な方法が必要でした。
 */
export async function createOctokitClient(): Promise<Octokit> {
  try {
    const githubAuthOptions = await createGitHubAuthOptions();
    const githubBaseUrl = getGitHubBaseUrl();
    // baseURLが設定されている場合はオプションに追加します。そうでない場合は空のオブジェクトを展開して何もしないようにします。
    const githubBaseUrlOptions = githubBaseUrl == null ? {} : { baseUrl: githubBaseUrl.toString() };

    return new Octokit({
      auth: githubAuthOptions.token,
      ...githubBaseUrlOptions,
      userAgent: `kyosei (${githubAuthOptions.source})`,
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw new Error(`failed to create Octokit client: ${err.message}`, { cause: err });
    }
    throw new Error("failed to create Octokit client", { cause: err });
  }
}
