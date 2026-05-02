import { describe, expect, it } from "vitest";
import { formatSyncBase } from "../src/sync-base.ts";

describe("formatSyncBase", () => {
  it("rebaseしていないケースをフォーマットします", () => {
    expect(
      formatSyncBase({
        currentBranch: "feat",
        baseBranch: "master",
        owner: "ncaq",
        repo: "konoka",
        rebased: false,
      }),
    ).toBe("current=feat\nbase=master\nowner=ncaq\nrepo=konoka\nrebased=false\n");
  });

  it("rebaseしたケースをフォーマットします", () => {
    expect(
      formatSyncBase({
        currentBranch: "feat",
        baseBranch: "master",
        owner: "ncaq",
        repo: "konoka",
        rebased: true,
      }),
    ).toBe("current=feat\nbase=master\nowner=ncaq\nrepo=konoka\nrebased=true\n");
  });
});
