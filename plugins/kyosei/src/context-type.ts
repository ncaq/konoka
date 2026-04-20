/**
 * レビューコンテキストの型定義モジュール。
 */

/**
 * PRの識別情報。
 * owner, repo, PR番号の組み合わせでPRを一意に特定します。
 */
export interface PrIdentifier {
  /** リポジトリの所有者。ユーザーまたはOrganization。 */
  readonly owner: string;
  /** リポジトリ名。 */
  readonly repo: string;
  /** PR番号。 */
  readonly prNumber: number;
}

/**
 * GitHub出力のコンテキスト。
 * GitHub PRのURLから抽出された情報を保持します。
 * レビュー結果はGitHub PRにコメントとして投稿されます。
 */
export interface GitHubOutputContext {
  readonly output: "github";
  /** GitHubのホスト名。github.comまたはGitHub Enterpriseのドメイン。 */
  readonly host: string;
  readonly pr: PrIdentifier;
}

/**
 * ローカル出力のコンテキスト。
 * 引数が指定されないか、PR URLとして解析できない場合にこの出力先になります。
 * レビュー結果はターミナルに直接出力されます。
 */
export interface LocalOutputContext {
  readonly output: "local";
  readonly pr?: PrIdentifier;
  /** diff対象のベースブランチ名。PRのベースまたはリポジトリのデフォルトブランチ。 */
  readonly baseBranch: string;
  /** gitリモート名。省略時はリモートなし扱い。 */
  readonly remoteName?: string;
}

/**
 * レビューコンテキストの判別共用体。
 */
export type ReviewContext = GitHubOutputContext | LocalOutputContext;
