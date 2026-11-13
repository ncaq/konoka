import { Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";
import { formatSyncAndPush, parseCommitCount, toSyncAndPushOutput } from "../src/sync-and-push";

describe("formatSyncAndPush", () => {
  it("rebase未実施かつpushなしのケース", () => {
    expect(
      formatSyncAndPush({
        currentBranch: "feat",
        head: "feat",
        baseBranch: "master",
        owner: "ncaq",
        repo: "konoka",
        rebased: false,
        action: "none",
        commits: 1,
      }),
    ).toBe(
      [
        "current=feat",
        "head=feat",
        "base=master",
        "owner=ncaq",
        "repo=konoka",
        "rebased=false",
        "action=none",
        "commits=1",
        "",
      ].join("\n"),
    );
  });

  it("forkからstagingへrebaseしてforce pushしたケース", () => {
    expect(
      formatSyncAndPush({
        currentBranch: "feat",
        head: "ncaq:feat",
        baseBranch: "staging",
        owner: "NixOS",
        repo: "nixpkgs",
        rebased: true,
        action: "force",
        commits: 3,
      }),
    ).toBe(
      [
        "current=feat",
        "head=ncaq:feat",
        "base=staging",
        "owner=NixOS",
        "repo=nixpkgs",
        "rebased=true",
        "action=force",
        "commits=3",
        "",
      ].join("\n"),
    );
  });
});

describe("toSyncAndPushOutput", () => {
  const result = {
    currentBranch: "feat",
    baseBranch: "staging",
    baseRef: "refs/remotes/upstream/staging",
    owner: "NixOS",
    repo: "nixpkgs",
    rebased: false,
    action: "initial",
    commits: 1,
  } as const;

  it("push先のownerがbaseと異なれば`<owner>:<branch>`をheadにする", () => {
    expect(toSyncAndPushOutput({ ...result, pushOwner: Option.some("ncaq") }).head).toBe(
      "ncaq:feat",
    );
  });

  it("push先のownerがbaseと同じならブランチ名だけをheadにする", () => {
    expect(toSyncAndPushOutput({ ...result, pushOwner: Option.some("nixos") }).head).toBe("feat");
  });

  it("push先のownerが不明ならブランチ名だけをheadにする", () => {
    expect(toSyncAndPushOutput({ ...result, pushOwner: Option.none() }).head).toBe("feat");
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
