/**
 * 前回レビュー対象コミットから現headまでの「増分changeset」を判定するモジュール。
 */

import { Effect, Either, Schema } from "effect";
import type { Octokit } from "octokit";
import type { PrIdentifier } from "./context-type";
import { ShaSchema } from "./review-schema";

const NonNegativeIntSchema = Schema.Number.pipe(Schema.int(), Schema.nonNegative());

export const IncrementalChangesetStatusSchema = Schema.Literal(
  "tree-identical", // tree SHA同一。rebase no-edit / 署名し直し / force pushして同一など。
  "diff-empty", // tree SHAは異なるが、`compareCommits`の`files`合算で`additions+deletions`が0。masterマージのみ等。
  "diff-present", // 実コード変更あり。通常レビューに倒します。
  "lookup-failed", // API取得に失敗。SHAがGCで消えた等。フェイルセーフで通常レビューに倒します。
);

/**
 * 増分changesetの出力スキーマ。
 * `status`単一フィールドでスキップ可否と理由を表します。
 * `lookup-failed`時はbaseSha/headSha/status以外のフィールドを省いて返します。
 */
export const IncrementalChangesetSchema = Schema.Struct({
  baseSha: ShaSchema,
  headSha: ShaSchema,
  baseTreeSha: Schema.optionalWith(ShaSchema, { exact: true }),
  headTreeSha: Schema.optionalWith(ShaSchema, { exact: true }),
  aheadBy: Schema.optionalWith(NonNegativeIntSchema, { exact: true }),
  behindBy: Schema.optionalWith(NonNegativeIntSchema, { exact: true }),
  changedFileCount: Schema.optionalWith(NonNegativeIntSchema, { exact: true }),
  changedLineCount: Schema.optionalWith(NonNegativeIntSchema, { exact: true }),
  status: IncrementalChangesetStatusSchema,
});

interface CompareFile {
  readonly additions?: number;
  readonly deletions?: number;
}

interface CompareResult {
  readonly aheadBy: number;
  readonly behindBy: number;
  readonly files: readonly CompareFile[];
}

function getCommitTreeSha(octokit: Octokit, target: PrIdentifier, sha: string): Effect.Effect<string, Error> {
  return Effect.tryPromise({
    try: async () => {
      const response = await octokit.rest.git.getCommit({
        owner: target.owner,
        repo: target.repo,
        commit_sha: sha,
      });
      return response.data.tree.sha;
    },
    catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
  });
}

function compareCommits(
  octokit: Octokit,
  target: PrIdentifier,
  baseSha: string,
  headSha: string,
): Effect.Effect<CompareResult, Error> {
  return Effect.tryPromise({
    try: async () => {
      const response = await octokit.rest.repos.compareCommits({
        owner: target.owner,
        repo: target.repo,
        base: baseSha,
        head: headSha,
      });
      return {
        aheadBy: response.data.ahead_by,
        behindBy: response.data.behind_by,
        files:
          response.data.files?.map<CompareFile>((file) => ({
            additions: file.additions,
            deletions: file.deletions,
          })) ?? [],
      };
    },
    catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
  });
}

function sumLineChanges(files: readonly CompareFile[]): number {
  return files.reduce((acc, file) => acc + (file.additions ?? 0) + (file.deletions ?? 0), 0);
}

function buildLookupFailed(baseSha: string, headSha: string): typeof IncrementalChangesetSchema.Type {
  return Schema.decodeUnknownSync(IncrementalChangesetSchema)({
    baseSha,
    headSha,
    status: "lookup-failed",
  });
}

/**
 * 前回レビュー対象コミット(`baseSha`)から現head(`headSha`)までの増分を判定します。
 * APIエラーは`Effect.fail`にせず`status: "lookup-failed"`にフォールバックさせます。
 */
export function getIncrementalChangeset(
  octokit: Octokit,
  target: PrIdentifier,
  baseSha: string,
  headSha: string,
): Effect.Effect<typeof IncrementalChangesetSchema.Type, never> {
  return Effect.gen(function* () {
    const fetched = yield* Effect.all(
      [
        getCommitTreeSha(octokit, target, baseSha),
        getCommitTreeSha(octokit, target, headSha),
        compareCommits(octokit, target, baseSha, headSha),
      ],
      { concurrency: "unbounded" },
    ).pipe(Effect.either);

    if (Either.isLeft(fetched)) {
      yield* Effect.logWarning(`failed to compute incremental changeset: ${fetched.left.message}`);
      return buildLookupFailed(baseSha, headSha);
    }

    const [baseTreeSha, headTreeSha, compare] = fetched.right;
    const changedFileCount = compare.files.length;
    const changedLineCount = sumLineChanges(compare.files);

    if (baseTreeSha === headTreeSha) {
      return Schema.decodeUnknownSync(IncrementalChangesetSchema)({
        baseSha,
        headSha,
        baseTreeSha,
        headTreeSha,
        aheadBy: compare.aheadBy,
        behindBy: compare.behindBy,
        changedFileCount,
        changedLineCount,
        status: "tree-identical",
      });
    }

    const status: "diff-empty" | "diff-present" = changedLineCount === 0 ? "diff-empty" : "diff-present";
    return Schema.decodeUnknownSync(IncrementalChangesetSchema)({
      baseSha,
      headSha,
      baseTreeSha,
      headTreeSha,
      aheadBy: compare.aheadBy,
      behindBy: compare.behindBy,
      changedFileCount,
      changedLineCount,
      status,
    });
  });
}
