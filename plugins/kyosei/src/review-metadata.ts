/**
 * レビューサマリー本文の末尾に付与する`<details>`折りたたみメタデータの組み立て。
 * フッターの整形は LLM ではなくNode.js側で行います。
 * 入力スキーマの`metadata`で渡される値と、
 * プロセス側で取得できる値(プラグインバージョン、Claude Codeのバージョン、実行環境など)を合わせて、
 * mustacheテンプレートでレンダリングします。
 * 取得に失敗した値は行ごと消さず`unknown`として表示し、
 * 異変として目につきやすいようにしています。
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
import reviewMetadataFooterTemplate from "./review-metadata-footer.mustache?raw";
import { ExecutionSchema, FooterViewSchema, pickNonBlank, ReviewSubmissionSchema } from "./review-schema";

/**
 * `claude --version` の出力からバージョン文字列を抽出します。
 * 取得に失敗した場合や出力が想定と異なる場合は警告ログを出して`Option.none`を返します。
 * 戻り値は`FooterViewSchema`に渡され、SemVer形式でなければ`"unknown"`に正規化されます。
 */
function detectClaudeCodeVersion(): Effect.Effect<Option.Option<string>, never, CommandExecutor.CommandExecutor> {
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
  }).pipe(Option.map(({ serverUrl, repository, runId }) => `${serverUrl}/${repository}/actions/runs/${runId}`));
}

/**
 * フッターレンダリング用のビューを構築します。
 * 各フィールドの正規化(SHA形式の判定、空文字の扱い、SemVer判定など)は`FooterViewSchema`が担うため、
 * ここではrawな値をそのまま渡します。
 */
export function buildFooterView(
  submission: typeof ReviewSubmissionSchema.Type,
): Effect.Effect<typeof FooterViewSchema.Type, never, CommandExecutor.CommandExecutor> {
  return Effect.gen(function* () {
    const claudeCodeVersion = yield* detectClaudeCodeVersion();
    const runUrl = lookupRunUrlString();
    return Schema.decodeUnknownSync(FooterViewSchema)({
      commit: submission.headCommitId,
      pr: submission.prNumber,
      kyoseiVersion: pluginManifest.version,
      kyoseiActionVersion: process.env["KYOSEI_ACTION_VERSION"],
      claudeCodeVersion: Option.getOrUndefined(claudeCodeVersion),
      model: submission.metadata?.model,
      execution: lookupExecution(),
      ...(Option.isSome(runUrl) ? { runUrl: runUrl.value } : {}),
    });
  });
}

/**
 * レビュー本文の末尾にメタデータフッターを付与した文字列を返します。
 * テンプレートエンジンにはmustacheを使い、文字列連結による組み立てやインジェクションの余地を避けています。
 */
export function mkBodyAppendMetadata(
  submission: typeof ReviewSubmissionSchema.Type,
): Effect.Effect<string, never, CommandExecutor.CommandExecutor> {
  return Effect.gen(function* () {
    const view = yield* buildFooterView(submission);
    const renderInput = {
      ...view,
      runUrl: view.runUrl?.toString(),
    };
    return submission.body + "\n" + mustache.render(reviewMetadataFooterTemplate, renderInput);
  });
}
