/**
 * レビュー返信・resolve投稿関係のスキーマと型定義をまとめたモジュール。
 * 循環参照を避けるためにスキーマ関連はまとめたほうが良いことが多い。
 */

import { Effect, ParseResult, Schema } from "effect";

/** PR 番号は正の整数。 */
export const PrNumberSchema = Schema.Number.pipe(Schema.int(), Schema.positive());

/**
 * 1つのレビュースレッドへの返信指定。
 * `threadId`はconversation.jsonの`reviewThreads[].id`(GraphQL node ID)をそのまま使います。
 */
export const ThreadReplySchema = Schema.Struct({
  threadId: Schema.NonEmptyString,
  /** 返信本文。Markdown。 */
  body: Schema.NonEmptyString,
  /** trueなら返信後にスレッドをresolveします。 */
  resolve: Schema.Boolean,
});

export type ThreadReply = typeof ThreadReplySchema.Type;

/**
 * 返信+resolve投稿の全体の入力スキーマ。
 */
export const ReplySubmissionSchema = Schema.Struct({
  owner: Schema.NonEmptyString,
  repo: Schema.NonEmptyString,
  prNumber: PrNumberSchema,
  /** レビュースレッドへの返信の配列。空配列も許容します。 */
  threadReplies: Schema.Array(ThreadReplySchema),
  /**
   * PR全体への総括コメント(省略可)。
   * レビュー本文(スレッドではないreview body)への応答はスレッド返信APIが存在しないため、
   * こちらで行います。
   */
  summaryComment: Schema.optionalWith(Schema.NonEmptyString, { exact: true }),
});

export type ReplySubmission = typeof ReplySubmissionSchema.Type;

/** スレッド1件の投稿成功の結果。 */
export const ThreadReplyResultSchema = Schema.Struct({
  threadId: Schema.NonEmptyString,
  /** 投稿された返信コメントのURL。 */
  replyUrl: Schema.URL,
  /** resolveまで完了したかどうか。 */
  resolved: Schema.Boolean,
});

/** スレッド1件の投稿失敗の結果。 */
export const ThreadReplyFailureSchema = Schema.Struct({
  threadId: Schema.NonEmptyString,
  message: Schema.NonEmptyString,
});

/** 返信+resolve投稿の全体の結果スキーマ。 */
export const ReplySubmissionResultSchema = Schema.Struct({
  succeeded: Schema.Array(ThreadReplyResultSchema),
  failed: Schema.Array(ThreadReplyFailureSchema),
  /** 総括コメントのURL。投稿した場合のみ含まれます。 */
  summaryCommentUrl: Schema.optionalWith(Schema.URL, { exact: true }),
});

export type ReplySubmissionResult = typeof ReplySubmissionResultSchema.Type;

/**
 * JSON文字列をパース・バリデーションして`ReplySubmission`に変換します。
 * JSONパースまたはバリデーションの失敗は`ParseError`として型付きの失敗になります。
 */
export function decodeReplySubmission(
  input: string,
): Effect.Effect<ReplySubmission, ParseResult.ParseError> {
  return Schema.decodeUnknown(Schema.parseJson(ReplySubmissionSchema), {
    onExcessProperty: "error",
  })(input);
}
