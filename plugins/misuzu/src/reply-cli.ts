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
import {
  decodeReplySubmission,
  ReplySubmissionResultSchema,
  ReplySubmissionSchema,
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

/** CLI実行の結果。`output`は標準出力へ表示するJSON文字列です。 */
export interface ReplyCliOutcome {
  readonly output: string;
  /** 一部の投稿が失敗したかどうか。trueなら呼び出し側は非0で終了すべきです。 */
  readonly partialFailure: boolean;
}

/**
 * 投稿JSONファイルを読み込み、dry-runなら検証済みデータを、
 * 実行なら投稿結果を出力用JSONとして返します。
 * Octokitクライアントの生成は遅延させ、dry-runではGitHubアクセスを行いません。
 */
export function runReplyAndResolve(options: {
  readonly submissionPath: string;
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
    if (options.dryRun) {
      const encodedSubmission = yield* Schema.encode(Schema.parseJson(ReplySubmissionSchema))(
        submission,
      );
      return {
        output: `{"dryRun":true,"submission":${encodedSubmission}}`,
        partialFailure: false,
      };
    }
    const octokit = yield* options.makeOctokit;
    const result = yield* submitReplies(octokit, submission);
    const output = yield* Schema.encode(Schema.parseJson(ReplySubmissionResultSchema))(result);
    return { output, partialFailure: 0 < result.failed.length };
  });
}
