import { describe, expect, it } from "vitest";
import { formatSyncAndPush } from "../src/sync-and-push";

describe("formatSyncAndPush", () => {
  it("rebase未実施かつpushなしのケース", () => {
    expect(
      formatSyncAndPush({
        currentBranch: "feat",
        baseBranch: "master",
        owner: "ncaq",
        repo: "konoka",
        rebased: false,
        action: "none",
      }),
    ).toBe("current=feat\nbase=master\nowner=ncaq\nrepo=konoka\nrebased=false\naction=none\n");
  });

  it("rebaseしてforce pushしたケース", () => {
    expect(
      formatSyncAndPush({
        currentBranch: "feat",
        baseBranch: "master",
        owner: "ncaq",
        repo: "konoka",
        rebased: true,
        action: "force",
      }),
    ).toBe("current=feat\nbase=master\nowner=ncaq\nrepo=konoka\nrebased=true\naction=force\n");
  });
});
