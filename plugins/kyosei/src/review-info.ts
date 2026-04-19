/**
 * レビュー情報を統合して取得するモジュール。
 * 変更セット取得と会話取得を1回の呼び出しで行います。
 */

import type { Octokit } from "octokit";
import type { Changeset } from "./changeset.js";
import { getChangeset } from "./changeset.js";
import type { ReviewContext } from "./context.js";
import type { Conversation } from "./conversation.js";
import { getConversation } from "./conversation.js";

/** レビュー情報。conversationはPRが特定できた場合のみ含まれます。 */
export interface ReviewInfo {
  readonly context: ReviewContext;
  readonly changeset: Changeset;
  readonly conversation?: Conversation;
}

/**
 * レビューコンテキストに応じてレビュー情報を統合的に取得します。
 * PRが特定できている場合はchangesetとconversationを並列で取得します。
 */
export async function getReviewInfo(octokit: Octokit, context: ReviewContext): Promise<ReviewInfo> {
  if (context.pr != null) {
    const [changeset, conversation] = await Promise.all([
      getChangeset(octokit, context),
      getConversation(octokit, context.pr),
    ]);
    return { context, changeset, conversation };
  }
  const changeset = await getChangeset(octokit, context);
  return { context, changeset };
}
