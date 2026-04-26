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
import { Schema } from "effect";
import mustache from "mustache";
import pluginManifest from "../.claude-plugin/plugin.json" with { type: "json" };
import { execFileAsync } from "./exec";
import reviewMetadataFooterTemplate from "./review-metadata-footer.mustache?raw";
import { ExecutionSchema, FooterViewSchema, pickNonBlank, ReviewSubmissionSchema } from "./review-schema";

/**
 * `claude --version` の出力からバージョン文字列を抽出します。
 * 取得に失敗した場合や出力が想定と異なる場合は警告ログを出して`undefined`を返します。
 * 戻り値はそのままスキーマに渡され、SemVer形式でなければ`"unknown"`に正規化されます。
 */
async function detectClaudeCodeVersion(): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("claude", ["--version"]);
    // `claude --version` の出力は `2.1.114 (Claude Code)\n` のような形式。
    // 先頭の空白区切りトークンがバージョン文字列。
    const versionToken = pickNonBlank(stdout.split(/\s+/)[0]);
    if (versionToken == null) {
      console.warn(`warn: empty 'claude --version' output: ${stdout.trim()}`);
    }
    return versionToken;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`warn: failed to detect Claude Code version: ${message}`);
    return undefined;
  }
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

/** GitHub Actions環境変数からRun URLの文字列を組み立てます。1つでも欠けていれば`undefined`を返します。 */
function lookupRunUrlString(): string | undefined {
  const serverUrl = pickNonBlank(process.env["GITHUB_SERVER_URL"]);
  const repository = pickNonBlank(process.env["GITHUB_REPOSITORY"]);
  const runId = pickNonBlank(process.env["GITHUB_RUN_ID"]);
  if (serverUrl == null || repository == null || runId == null) {
    return undefined;
  }
  return `${serverUrl}/${repository}/actions/runs/${runId}`;
}

/**
 * フッターレンダリング用のビューを構築します。
 * 各フィールドの正規化(SHA形式の判定、空文字の扱い、SemVer判定など)は`FooterViewSchema`が担うため、
 * ここではrawな値をそのまま渡します。
 */
export async function buildFooterView(
  submission: typeof ReviewSubmissionSchema.Type,
): Promise<typeof FooterViewSchema.Type> {
  const runUrl = lookupRunUrlString();
  return Schema.decodeUnknownSync(FooterViewSchema)({
    commit: submission.headCommitId,
    pr: submission.prNumber,
    kyoseiVersion: pluginManifest.version,
    kyoseiActionVersion: process.env["KYOSEI_ACTION_VERSION"],
    claudeCodeVersion: await detectClaudeCodeVersion(),
    model: submission.metadata?.model,
    execution: lookupExecution(),
    ...(runUrl != null ? { runUrl } : {}),
  });
}

/**
 * レビュー本文の末尾にメタデータフッターを付与した文字列を返します。
 * テンプレートエンジンにはmustacheを使い、文字列連結による組み立てやインジェクションの余地を避けています。
 */
export async function mkBodyAppendMetadata(submission: typeof ReviewSubmissionSchema.Type): Promise<string> {
  const view = await buildFooterView(submission);
  const renderInput = {
    ...view,
    runUrl: view.runUrl?.toString(),
  };
  return submission.body + "\n" + mustache.render(reviewMetadataFooterTemplate, renderInput);
}
