import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { formatSyncAndPush, parseCommitCount } from "../src/sync-and-push";

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
        commits: 1,
      }),
    ).toBe(
      "current=feat\nbase=master\nowner=ncaq\nrepo=konoka\nrebased=false\naction=none\ncommits=1\n",
    );
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
        commits: 3,
      }),
    ).toBe(
      "current=feat\nbase=master\nowner=ncaq\nrepo=konoka\nrebased=true\naction=force\ncommits=3\n",
    );
  });
});

describe("parseCommitCount", () => {
  it("末尾改行付きの数値を解釈できる", () => {
    expect(Effect.runSync(parseCommitCount("1\n"))).toBe(1);
  });

  it("0を解釈できる", () => {
    expect(Effect.runSync(parseCommitCount("0"))).toBe(0);
  });

  it.each(["", "abc", "-1", "1.5"])("不正な出力%sは失敗する", (out) => {
    expect(Exit.isFailure(Effect.runSyncExit(parseCommitCount(out)))).toBe(true);
  });
});
