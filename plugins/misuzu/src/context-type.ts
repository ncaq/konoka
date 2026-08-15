/**
 * レビュー対応コンテキストの型定義モジュール。
 */

import { Schema } from "effect";
import { PrNumberSchema } from "./reply-schema";

/**
 * PRの識別情報。
 * owner, repo, PR番号の組み合わせでPRを一意に特定します。
 */
export const PrIdentifierSchema = Schema.Struct({
  /** リポジトリの所有者。ユーザーまたはOrganization。 */
  owner: Schema.NonEmptyString,
  /** リポジトリ名。 */
  repo: Schema.NonEmptyString,
  /** PR番号。 */
  prNumber: PrNumberSchema,
});

export type PrIdentifier = typeof PrIdentifierSchema.Type;

/**
 * URLフラグメントで指定された優先対応対象。
 * PR URLの`#pullrequestreview-<id>`等から抽出します。
 */
export const FocusSchema = Schema.Struct({
  /** 対象の種別。 */
  kind: Schema.Literal("review", "review-comment", "issue-comment"),
  /** GitHubのdatabase ID。URLフラグメントに含まれる数値。 */
  databaseId: Schema.Number.pipe(Schema.int(), Schema.positive()),
});

export type Focus = typeof FocusSchema.Type;

/**
 * レビュー対応のコンテキスト。
 *
 * misuzuはローカルでの対話実行が前提のため、
 * kyoseiのような出力先(`output`)の区別は持ちません。
 * `pr`の有無がそのまま「GitHub上のレビューへ返信できるかどうか」を表します。
 */
export const RespondContextSchema = Schema.Struct({
  /** 対象のPR。URL指定またはカレントブランチから特定できた場合のみ含まれます。 */
  pr: Schema.optionalWith(PrIdentifierSchema, { exact: true }),
  /** GitHubのホスト名。URLでPRを指定した場合のみ含まれます。 */
  host: Schema.optionalWith(Schema.NonEmptyString, { exact: true }),
  /** URLフラグメントから抽出した優先対応対象。省略時はPR全体が対象。 */
  focus: Schema.optionalWith(FocusSchema, { exact: true }),
});

export type RespondContext = typeof RespondContextSchema.Type;
