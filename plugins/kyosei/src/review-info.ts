/**
 * レビュー情報を統合して取得するモジュール。
 * 変更セット取得と会話取得を1回の呼び出しで行います。
 * PRが特定できかつ前回kyoseiレビューがある場合は、増分changesetも併せて返します。
 */

import { type CommandExecutor } from "@effect/platform";
import { Effect, Option } from "effect";
import type { Octokit } from "octokit";
import type { Changeset } from "./changeset";
import { getChangeset } from "./changeset";
import type { ReviewContext } from "./context-type";
import type { Conversation } from "./conversation";
import { getConversation } from "./conversation";
import { getIncrementalChangeset, type IncrementalChangesetSchema } from "./incremental-changeset";
import { pickPreviousKyoseiReview, type PreviousReviewSchema } from "./previous-review";

/** レビュー情報。conversationはPRが特定できた場合のみ含まれます。 */
export interface ReviewInfo {
  readonly context: ReviewContext;
  readonly changeset: Changeset;
  readonly conversation?: Conversation;
  readonly previousReview?: typeof PreviousReviewSchema.Type;
  readonly incrementalChangeset?: typeof IncrementalChangesetSchema.Type;
}

/**
 * レビューコンテキストに応じてレビュー情報を統合的に取得します。
 * PRが特定できている場合はchangesetとconversationを並列で取得します。
 * 前回kyoseiレビューが復元できかつ`headCommitId`が取れている場合のみ、増分changesetを追加で取得します。
 */
export function getReviewInfo(
  octokit: Octokit,
  context: ReviewContext,
): Effect.Effect<ReviewInfo, Error, CommandExecutor.CommandExecutor> {
  return Effect.gen(function* () {
    if (context.pr == null) {
      const changeset = yield* getChangeset(octokit, context);
      return { context, changeset };
    }

    const [changeset, conversation] = yield* Effect.all(
      [getChangeset(octokit, context), getConversation(octokit, context.pr)],
      { concurrency: "unbounded" },
    );

    const previousReviewOption = pickPreviousKyoseiReview(conversation);
    if (Option.isNone(previousReviewOption) || changeset.headCommitId == null) {
      return { context, changeset, conversation };
    }

    const previousReview = previousReviewOption.value;
    const incrementalChangeset = yield* getIncrementalChangeset(
      octokit,
      context.pr,
      previousReview.metadata.commit,
      changeset.headCommitId,
    );

    return {
      context,
      changeset,
      conversation,
      previousReview,
      incrementalChangeset,
    };
  });
}
