/**
 * レビューサマリー本文の末尾に付与する`<details>`折りたたみメタデータの組み立て。
 * フッターの整形は LLM ではなくNode.js側で行います。
 * 入力スキーマの`metadata`で渡される値と、
 * プロセス側で取得できる値(プラグインバージョン、Claude Codeのバージョン、実行環境など)を合わせて、
 * mustacheテンプレートでレンダリングします。
 * 取得に失敗した値は行ごと消さず`unknown`として表示し、
 * 異変として目につきやすいようにしています。
 *
 * 各項目には辿れる先があるならリンクを貼ります。
 * リンクURLはメタデータそのものではなく表示の都合で導出する値なので、
 * `MetadataSchema`には含めずレンダリング時のビューにだけ足します。
 *
 * 各値の正規化(SHA形式の判定、SemVer形式の判定、空文字フォールバックなど)は、
 * 個別のヘルパー関数ではなく`Schema.transform`でスキーマ自体に組み込んでいます。
 * 不正値や未指定は`decodeUnknownSync`を通すだけで自動的に`"unknown"`に正規化されます。
 */

import process from "node:process";
import { Command, type CommandExecutor } from "@effect/platform";
import { Effect, Option, Schema } from "effect";
import mustache from "mustache";
import pluginManifest from "../.claude-plugin/plugin.json" with { type: "json" };
import internalErrorsSectionTemplate from "./internal-errors-section.mustache?raw";
import reviewMetadataFooterTemplate from "./review-metadata-footer.mustache?raw";
import reviewMetadataLinkTemplate from "./review-metadata-link.mustache?raw";
import {
  ExecutionSchema,
  NonEmptyStringOrUnknownSchema,
  pickNonBlank,
  PrNumberSchema,
  ReviewSubmissionSchema,
  SemVerOrUnknownSchema,
  SemVerSchema,
  ShaSchema,
} from "./review-schema";

/**
 * レビューフッターのメタデータスキーマ。
 * レンダリング(投稿時)とパース復元(再レビュー時)の両方で同じ型を往復させます。
 * `commit`/`pr`/`kyoseiVersion`は`unknown`フォールバックを設けません。
 * これらが欠落しているフッターは復元失敗扱い(=通常レビューにフォールバック)とします。
 */
export const MetadataSchema = Schema.Struct({
  commit: ShaSchema,
  pr: PrNumberSchema,
  kyoseiVersion: SemVerSchema,
  kyoseiActionVersion: SemVerOrUnknownSchema,
  claudeCodeVersion: SemVerOrUnknownSchema,
  model: NonEmptyStringOrUnknownSchema,
  execution: ExecutionSchema,
  runUrl: Schema.optionalWith(Schema.URL, { exact: true }),
});

/**
 * `claude --version` の出力からバージョン文字列を抽出します。
 * 取得に失敗した場合や出力が想定と異なる場合は警告ログを出して`Option.none`を返します。
 * 戻り値は`MetadataSchema`に渡され、SemVer形式でなければ`"unknown"`に正規化されます。
 */
function detectClaudeCodeVersion(): Effect.Effect<
  Option.Option<string>,
  never,
  CommandExecutor.CommandExecutor
> {
  return Command.string(Command.make("claude", "--version")).pipe(
    Effect.matchEffect({
      onFailure: (err) =>
        Effect.logWarning(`failed to detect Claude Code version: ${err.message}`).pipe(
          Effect.as(Option.none<string>()),
        ),
      onSuccess: (stdout) =>
        Effect.gen(function* () {
          // `claude --version` の出力は `2.1.114 (Claude Code)\n` のような形式。
          // 先頭の空白区切りトークンがバージョン文字列。
          const versionToken = Option.fromNullable(pickNonBlank(stdout.split(/\s+/)[0]));
          if (Option.isNone(versionToken)) {
            yield* Effect.logWarning(`empty 'claude --version' output: ${stdout.trim()}`);
          }
          return versionToken;
        }),
    }),
  );
}

/** 環境変数から実行環境(GitHub Actions / Claude Code CLI / unknown)を取得します。 */
function lookupExecution(): typeof ExecutionSchema.Type {
  if (process.env["GITHUB_ACTIONS"] === "true") {
    return "GitHub Actions";
  }
  if (process.env["CLAUDECODE"] === "1") {
    return "Claude Code CLI";
  }
  return "unknown";
}

/** GitHub Actions環境変数からRun URLの文字列を組み立てます。1つでも欠けていれば`Option.none`を返します。 */
function lookupRunUrlString(): Option.Option<string> {
  return Option.all({
    serverUrl: Option.fromNullable(pickNonBlank(process.env["GITHUB_SERVER_URL"])),
    repository: Option.fromNullable(pickNonBlank(process.env["GITHUB_REPOSITORY"])),
    runId: Option.fromNullable(pickNonBlank(process.env["GITHUB_RUN_ID"])),
  }).pipe(
    Option.map(
      ({ serverUrl, repository, runId }) => `${serverUrl}/${repository}/actions/runs/${runId}`,
    ),
  );
}

/** URL文字列をパースします。形式が不正な場合は`Option.none`を返し、その項目はリンクなしで表示させます。 */
const parseUrl = Option.liftThrowable((raw: string) => new URL(raw));

/**
 * GitHubのベースURLを取得します。
 * GitHub Enterprise Serverでの実行も想定して`GITHUB_SERVER_URL`を優先し、
 * ローカル実行などで設定されていない場合は公開GitHubにフォールバックします。
 * 末尾スラッシュがあるとパスを連結した時にダブルスラッシュになるため落とします。
 */
function lookupServerUrl(): string {
  const serverUrl = pickNonBlank(process.env["GITHUB_SERVER_URL"]) ?? "https://github.com";
  return serverUrl.replace(/\/+$/, "");
}

/**
 * SemVerのバージョンからGitHubリリースページのURLを組み立てます。
 * リリースタグは`v`プレフィックス付きの規約に従います。
 * バージョンを取得できず`unknown`になっている場合はリンク先が定まらないため`Option.none`を返します。
 */
function buildReleaseTagUrl(
  repositoryUrl: string,
  version: typeof SemVerOrUnknownSchema.Type,
): Option.Option<URL> {
  return version === "unknown"
    ? Option.none()
    : parseUrl(`${repositoryUrl}/releases/tag/v${version}`);
}

/** テンプレートへ渡すためにURLを文字列化します。URLが無い項目はリンクなしとして`undefined`のままにします。 */
function toUrlString(url: Option.Option<URL>): string | undefined {
  return Option.getOrUndefined(url)?.toString();
}

/**
 * フッターに表示する1項目分の値。
 * `url`があればMarkdownリンクとして、無ければプレーンテキストとしてレンダリングされます。
 */
interface LinkedValue {
  readonly text: string;
  readonly url: string | undefined;
}

/**
 * フッターの各項目に対応するリンク付きの値を組み立てます。
 * コミットとPRはレビュー対象リポジトリを指し、
 * kyosei-actionとClaude Codeはそのバージョンのリリースページを指します。
 * `owner`と`repo`はURLに現れるため、パスセグメントとしてエスケープしてから組み立てます。
 *
 * kyoseiバージョンとモデルにリンクを貼らないのは意図的です。
 * kyoseiのプラグインバージョンに対応するGitタグはkonokaには存在せず(タグはマーケットプレイスバージョン)、
 * モデル名にもバージョン固有の公式ページが存在しないため、
 * バージョンと一致しないリンクを貼るよりリンクなしの方が正確です。
 */
function buildLinkedValues(
  submission: typeof ReviewSubmissionSchema.Type,
  view: typeof MetadataSchema.Type,
): Record<"commit" | "pr" | "kyoseiAction" | "claudeCode", LinkedValue> {
  const owner = encodeURIComponent(submission.owner);
  const repo = encodeURIComponent(submission.repo);
  const repositoryUrl = `${lookupServerUrl()}/${owner}/${repo}`;
  return {
    commit: {
      text: view.commit,
      url: toUrlString(parseUrl(`${repositoryUrl}/commit/${view.commit}`)),
    },
    pr: {
      text: `#${view.pr}`,
      url: toUrlString(parseUrl(`${repositoryUrl}/pull/${view.pr}`)),
    },
    kyoseiAction: {
      text: view.kyoseiActionVersion,
      url: toUrlString(
        buildReleaseTagUrl("https://github.com/ncaq/kyosei-action", view.kyoseiActionVersion),
      ),
    },
    claudeCode: {
      text: view.claudeCodeVersion,
      url: toUrlString(
        buildReleaseTagUrl("https://github.com/anthropics/claude-code", view.claudeCodeVersion),
      ),
    },
  };
}

/**
 * フッターレンダリング用のビューを構築します。
 * 各フィールドの正規化(SHA形式の判定、空文字の扱い、SemVer判定など)は`MetadataSchema`が担うため、
 * ここではrawな値をそのまま渡します。
 */
export function buildFooterView(
  submission: typeof ReviewSubmissionSchema.Type,
): Effect.Effect<typeof MetadataSchema.Type, never, CommandExecutor.CommandExecutor> {
  return Effect.gen(function* () {
    const claudeCodeVersion = yield* detectClaudeCodeVersion();
    const runUrl = lookupRunUrlString();
    // 不正値は`MetadataSchema`が`"unknown"`に正規化するため、
    // デコード失敗はプログラムの欠陥として扱い、`orDie`で欠陥に変換します。
    return yield* Effect.orDie(
      Schema.decodeUnknown(MetadataSchema)({
        commit: submission.headCommitId,
        pr: submission.prNumber,
        kyoseiVersion: pluginManifest.version,
        kyoseiActionVersion: process.env["KYOSEI_ACTION_VERSION"],
        claudeCodeVersion: Option.getOrUndefined(claudeCodeVersion),
        model: submission.metadata?.model,
        execution: lookupExecution(),
        ...(Option.isSome(runUrl) ? { runUrl: runUrl.value } : {}),
      }),
    );
  });
}

/**
 * 内部エラーセクションをレンダリングします。
 * `internalErrors`が未指定または空配列の場合は空文字を返し、
 * 呼び出し側で結合時にスキップできるようにします。
 * `body`はMarkdownとしてそのまま埋め込みます。
 * コードブロックで囲むかどうかなどの整形判断は呼び出し側のLLMに委ねます。
 */
function renderInternalErrorsSection(submission: typeof ReviewSubmissionSchema.Type): string {
  const errors = submission.internalErrors;
  if (errors == null || errors.length === 0) {
    return "";
  }
  return mustache.render(internalErrorsSectionTemplate, { errors });
}

/**
 * レビュー本文に追記要素(内部エラーセクション、メタデータフッター)を付与した文字列を返します。
 * テンプレートエンジンにはmustacheを使い、文字列連結による組み立てやインジェクションの余地を避けています。
 * 内部エラーセクションは`internalErrors`が空のときは出力されず、
 * フッターは常時末尾に折りたたみで付与されます。
 */
export function buildReviewBody(
  submission: typeof ReviewSubmissionSchema.Type,
): Effect.Effect<string, never, CommandExecutor.CommandExecutor> {
  return Effect.gen(function* () {
    const view = yield* buildFooterView(submission);
    const renderInput = {
      ...view,
      runUrl: view.runUrl?.toString(),
      ...buildLinkedValues(submission, view),
    };
    // 部分テンプレートは末尾の改行を落として、行の途中に差し込んでも改行が入らないようにします。
    const footer = mustache.render(reviewMetadataFooterTemplate, renderInput, {
      link: reviewMetadataLinkTemplate.trimEnd(),
    });
    const internalErrorsSection = renderInternalErrorsSection(submission);
    return [submission.body, internalErrorsSection, footer]
      .filter((section) => section.length > 0)
      .join("\n");
  });
}
