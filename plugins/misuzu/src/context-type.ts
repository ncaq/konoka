/**
 * レビューコンテキストの型定義モジュール。
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
 * GitHub出力のコンテキスト。
 * GitHub PRのURLから抽出された情報を保持します。
 * レビュー対応の返信はGitHub PRに投稿されます。
 */
export const GitHubOutputContextSchema = Schema.Struct({
  output: Schema.Literal("github"),
  /** GitHubのホスト名。github.comまたはGitHub Enterpriseのドメイン。 */
  host: Schema.NonEmptyString,
  pr: PrIdentifierSchema,
  /** URLフラグメントから抽出した優先対応対象。省略時はPR全体が対象。 */
  focus: Schema.optionalWith(FocusSchema, { exact: true }),
});

export type GitHubOutputContext = typeof GitHubOutputContextSchema.Type;

/**
 * ローカル出力のコンテキスト。
 * 引数が指定されないか、PR URLとして解析できない場合にこの出力先になります。
 * レビュー結果はターミナルに直接出力されます。
 */
export const LocalOutputContextSchema = Schema.Struct({
  output: Schema.Literal("local"),
  pr: Schema.optionalWith(PrIdentifierSchema, { exact: true }),
  /** diff対象のベースブランチ名。PRのベースまたはリポジトリのデフォルトブランチ。 */
  baseBranch: Schema.NonEmptyString,
  /** gitリモート名。省略時はリモートなし扱い。 */
  remoteName: Schema.optionalWith(Schema.NonEmptyString, { exact: true }),
});

export type LocalOutputContext = typeof LocalOutputContextSchema.Type;

/**
 * レビューコンテキストの判別共用体。
 */
export const ReviewContextSchema = Schema.Union(
  GitHubOutputContextSchema,
  LocalOutputContextSchema,
);

export type ReviewContext = typeof ReviewContextSchema.Type;
