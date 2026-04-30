/**
 * PRの`Conversation`から、過去のkyoseiレビューのうちフッターメタデータを復元できる最新のものを抽出するモジュール。
 * レビューはフェイルセーフとして少しでも違う場合は積極的に復元失敗とします。
 */

import { DateTime, Either, Option, Order, Schema } from "effect";
import type { Conversation } from "./conversation";
import { MetadataSchema } from "./review-metadata";
import { parseFooterMetadata } from "./review-metadata-parser";

/**
 * 過去のkyoseiレビューを表すスキーマ。
 */
export const PreviousReviewSchema = Schema.Struct({
  reviewId: Schema.NonEmptyString,
  event: Schema.NonEmptyString,
  /** `submittedAt`はUTCの日時として保存して、ISO 8601文字列に戻します。 */
  submittedAt: Schema.DateTimeUtc,
  metadata: MetadataSchema,
});

type ReviewCandidate = typeof PreviousReviewSchema.Type;

const decodeDateTimeUtc = Schema.decodeUnknownEither(Schema.DateTimeUtc);

/** 1件のreviewから候補を組み立てます。失敗時は`Option.none`を返します。 */
function toCandidate(review: Conversation["reviews"][number]): Option.Option<ReviewCandidate> {
  const metadata = parseFooterMetadata(review.body);
  const submittedAt = decodeDateTimeUtc(review.submittedAt);
  if (review.submittedAt == null || Option.isNone(metadata) || Either.isLeft(submittedAt)) {
    return Option.none();
  }
  return Option.some({
    reviewId: review.id,
    event: review.state,
    submittedAt: submittedAt.right,
    metadata: metadata.value,
  });
}

const candidateOrderDesc = Order.reverse(
  Order.mapInput(DateTime.Order, (candidate: ReviewCandidate) => candidate.submittedAt),
);

/**
 * conversationから、フッターメタデータを復元できる最新のkyoseiレビューを返します。
 * 候補がなければ`Option.none`。
 */
export function pickPreviousKyoseiReview(conversation: Conversation): Option.Option<typeof PreviousReviewSchema.Type> {
  const candidates = conversation.reviews
    .map((review) => toCandidate(review))
    .filter(Option.isSome)
    .map((review) => review.value)
    .toSorted(candidateOrderDesc);
  if (candidates.length === 0) {
    return Option.none();
  }
  const latest = candidates[0];
  if (latest == null) {
    return Option.none();
  }
  return Option.some(latest);
}
