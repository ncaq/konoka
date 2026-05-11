import { it } from "@effect/vitest";
import { Effect } from "effect";
import type { Octokit } from "octokit";
import { describe, expect, vi } from "vitest";
import type { PrIdentifier } from "../src/context-type";
import { getIncrementalChangeset } from "../src/incremental-changeset";

const target: PrIdentifier = { owner: "test-owner", repo: "test-repo", prNumber: 42 };
const baseSha = "abcdef1abcdef1abcdef1abcdef1abcdef1abcd";
const headSha = "1234567123456712345671234567123456712345";

interface FakeFile {
  readonly additions: number;
  readonly deletions: number;
}

function buildOctokit(overrides: {
  baseTreeSha?: string;
  headTreeSha?: string;
  aheadBy?: number;
  behindBy?: number;
  files?: readonly FakeFile[];
  failGetCommit?: boolean;
  failCompare?: boolean;
}): Octokit {
  const treeBySha: Record<string, string | undefined> = {
    [baseSha]: overrides.baseTreeSha,
    [headSha]: overrides.headTreeSha,
  };
  const getCommit = vi.fn(({ commit_sha }: { commit_sha: string }) => {
    if (overrides.failGetCommit === true) {
      return Promise.reject(new Error("getCommit failed"));
    }
    const sha = treeBySha[commit_sha];
    if (sha == null) {
      return Promise.reject(new Error(`unknown sha: ${commit_sha}`));
    }
    return Promise.resolve({ data: { tree: { sha } } });
  });
  const compareCommits = vi.fn(() => {
    if (overrides.failCompare === true) {
      return Promise.reject(new Error("compareCommits failed"));
    }
    return Promise.resolve({
      data: {
        ahead_by: overrides.aheadBy ?? 0,
        behind_by: overrides.behindBy ?? 0,
        files: overrides.files ?? [],
      },
    });
  });
  return {
    rest: {
      git: { getCommit },
      repos: { compareCommits },
    },
  } as unknown as Octokit;
}

describe("getIncrementalChangeset", () => {
  it.effect("tree SHA一致なら tree-identical", () =>
    Effect.gen(function* () {
      const octokit = buildOctokit({
        baseTreeSha: "aaa0000000000000000000000000000000000000",
        headTreeSha: "aaa0000000000000000000000000000000000000",
        aheadBy: 1,
        behindBy: 1,
        files: [{ additions: 5, deletions: 3 }],
      });

      const result = yield* getIncrementalChangeset(octokit, target, baseSha, headSha);

      expect(result.status).toBe("tree-identical");
      expect(result.baseTreeSha).toBe("aaa0000000000000000000000000000000000000");
      expect(result.headTreeSha).toBe("aaa0000000000000000000000000000000000000");
    }),
  );

  it.effect("tree異なる + filesが空なら diff-empty", () =>
    Effect.gen(function* () {
      const octokit = buildOctokit({
        baseTreeSha: "bbb1000000000000000000000000000000000000",
        headTreeSha: "ccc2000000000000000000000000000000000000",
        aheadBy: 1,
        behindBy: 0,
        files: [],
      });

      const result = yield* getIncrementalChangeset(octokit, target, baseSha, headSha);

      expect(result.status).toBe("diff-empty");
      expect(result.changedFileCount).toBe(0);
      expect(result.changedLineCount).toBe(0);
    }),
  );

  it.effect("tree異なる + 全fileがadditions=0 deletions=0 なら diff-empty(リネームのみ等)", () =>
    Effect.gen(function* () {
      const octokit = buildOctokit({
        baseTreeSha: "bbb1000000000000000000000000000000000000",
        headTreeSha: "ccc2000000000000000000000000000000000000",
        aheadBy: 1,
        behindBy: 0,
        files: [
          { additions: 0, deletions: 0 },
          { additions: 0, deletions: 0 },
        ],
      });

      const result = yield* getIncrementalChangeset(octokit, target, baseSha, headSha);

      expect(result.status).toBe("diff-empty");
      expect(result.changedFileCount).toBe(2);
      expect(result.changedLineCount).toBe(0);
    }),
  );

  it.effect(
    "tree異なる + 一部fileに実差分行があれば diff-present(コンフリクト解決を含むmerge等)",
    () =>
      Effect.gen(function* () {
        const octokit = buildOctokit({
          baseTreeSha: "bbb1000000000000000000000000000000000000",
          headTreeSha: "ccc2000000000000000000000000000000000000",
          aheadBy: 1,
          behindBy: 0,
          files: [
            { additions: 0, deletions: 0 },
            { additions: 3, deletions: 1 },
          ],
        });

        const result = yield* getIncrementalChangeset(octokit, target, baseSha, headSha);

        expect(result.status).toBe("diff-present");
        expect(result.changedFileCount).toBe(2);
        expect(result.changedLineCount).toBe(4);
      }),
  );

  it.effect("getCommitが失敗したら lookup-failed", () =>
    Effect.gen(function* () {
      const octokit = buildOctokit({
        baseTreeSha: "bbb1000000000000000000000000000000000000",
        headTreeSha: "ccc2000000000000000000000000000000000000",
        failGetCommit: true,
      });

      const result = yield* getIncrementalChangeset(octokit, target, baseSha, headSha);

      expect(result.status).toBe("lookup-failed");
      expect(result.baseTreeSha).toBeUndefined();
      expect(result.headTreeSha).toBeUndefined();
    }),
  );

  it.effect("compareCommitsが失敗したら lookup-failed", () =>
    Effect.gen(function* () {
      const octokit = buildOctokit({
        baseTreeSha: "bbb1000000000000000000000000000000000000",
        headTreeSha: "ccc2000000000000000000000000000000000000",
        failCompare: true,
      });

      const result = yield* getIncrementalChangeset(octokit, target, baseSha, headSha);

      expect(result.status).toBe("lookup-failed");
    }),
  );
});
