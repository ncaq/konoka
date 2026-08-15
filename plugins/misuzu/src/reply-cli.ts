/**
 * reply-and-resolve CLIの本体ロジック。
 * binから分離してテスト可能にしています。
 *
 * 投稿JSONは引数の文字列ではなくファイルから読み込みます。
 * 返信本文にはレビューコメント由来のuntrustedな文字列が入るため、
 * シェルの引数として渡すとクォート崩れやコマンド実行(CWE-78)につながるからです。
 */

import { FileSystem, type CommandExecutor } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { Data, Effect, ParseResult, Schema } from "effect";
import type { Octokit } from "octokit";
import { RespondContextSchema, type PrIdentifier } from "./context-type";
import {
  decodeReplySubmission,
  ReplySubmissionResultSchema,
  ReplySubmissionSchema,
  type ReplySubmission,
} from "./reply-schema";
import { submitReplies } from "./thread-mutation";

/** 一部でも投稿に失敗した場合の失敗。SKILL側が失敗分のみ再試行できるように結果全体を保持します。 */
export class PartialSubmissionFailure extends Data.TaggedError("PartialSubmissionFailure")<{
  readonly encodedResult: string;
}> {
  override get message(): string {
    return `some replies failed: ${this.encodedResult}`;
  }
}

/** context.jsonにPR情報がなく、投稿先を検証できない場合の失敗。 */
export class ContextWithoutPr extends Data.TaggedError("ContextWithoutPr")<{
  readonly contextPath: string;
}> {
  override get message(): string {
    return (
      `context file has no pr: ${this.contextPath}. ` +
      "ローカルモードのコンテキストに対して返信を投稿することはできません。"
    );
  }
}

/** 投稿JSONの投稿先が検出済みコンテキストのPRと一致しない場合の失敗。 */
export class SubmissionTargetMismatch extends Data.TaggedError("SubmissionTargetMismatch")<{
  readonly expected: PrIdentifier;
  readonly actual: PrIdentifier;
}> {
  override get message(): string {
    const show = (pr: PrIdentifier): string => `${pr.owner}/${pr.repo}#${pr.prNumber}`;
    return (
      `submission target ${show(this.actual)} does not match ` +
      `detected context ${show(this.expected)}. ` +
      "誤ったリポジトリやPRへの投稿を防ぐため中止しました。"
    );
  }
}

/**
 * 投稿JSONの投稿先が`context.json`で検出済みのPRと一致することを検証します。
 * プロンプトインジェクションやエージェントの取り違えによる誤投稿を防ぎます。
 */
function verifySubmissionTarget(
  contextPath: string,
  submission: ReplySubmission,
): Effect.Effect<
  void,
  ContextWithoutPr | SubmissionTargetMismatch | ParseResult.ParseError | PlatformError,
  FileSystem.FileSystem
> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const raw = yield* fs.readFileString(contextPath);
    const context = yield* Schema.decodeUnknown(Schema.parseJson(RespondContextSchema))(raw);
    const expected = context.pr;
    if (expected == null) {
      return yield* new ContextWithoutPr({ contextPath });
    }
    const actual: PrIdentifier = {
      owner: submission.owner,
      repo: submission.repo,
      prNumber: submission.prNumber,
    };
    if (
      expected.owner !== actual.owner ||
      expected.repo !== actual.repo ||
      expected.prNumber !== actual.prNumber
    ) {
      return yield* new SubmissionTargetMismatch({ expected, actual });
    }
  });
}

/** CLI実行の結果。`output`は標準出力へ表示するJSON文字列です。 */
export interface ReplyCliOutcome {
  readonly output: string;
  /** 一部の投稿が失敗したかどうか。trueなら呼び出し側は非0で終了すべきです。 */
  readonly partialFailure: boolean;
}

/**
 * 投稿JSONファイルを読み込み、投稿先が`context.json`と一致することを検証した上で、
 * dry-runなら検証済みデータを、実行なら投稿結果を出力用JSONとして返します。
 * Octokitクライアントの生成は遅延させ、dry-runではGitHubアクセスを行いません。
 */
export function runReplyAndResolve(options: {
  readonly submissionPath: string;
  readonly contextPath: string;
  readonly dryRun: boolean;
  readonly makeOctokit: Effect.Effect<Octokit, Error, CommandExecutor.CommandExecutor>;
}): Effect.Effect<
  ReplyCliOutcome,
  Error | ParseResult.ParseError | PlatformError,
  FileSystem.FileSystem | CommandExecutor.CommandExecutor
> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const raw = yield* fs.readFileString(options.submissionPath);
    const submission = yield* decodeReplySubmission(raw);
    yield* verifySubmissionTarget(options.contextPath, submission);
    if (options.dryRun) {
      const encodedSubmission = yield* Schema.encode(ReplySubmissionSchema)(submission);
      return {
        output: JSON.stringify({ dryRun: true, submission: encodedSubmission }, null, 2),
        partialFailure: false,
      };
    }
    const octokit = yield* options.makeOctokit;
    const result = yield* submitReplies(octokit, submission);
    const output = yield* Schema.encode(
      Schema.parseJson(ReplySubmissionResultSchema, { space: 2 }),
    )(result);
    return {
      output,
      partialFailure: 0 < result.failed.length || result.summaryCommentError != null,
    };
  });
}
