import { Cause, Effect, Exit, Option, Schema } from "effect";
import { describe, expect, test } from "vitest";
import { AmbiguousBaseRemoteError, BaseRemoteNotFoundError, parseRepoInfo } from "../src/sync-base";

describe("BaseRemoteNotFoundError", () => {
  test("remoteが無ければ`(none)`と表示する", () => {
    expect(new BaseRemoteNotFoundError({ owner: "NixOS", repo: "nixpkgs", remotes: [] }).message)
      .toBe(`No git remote points to NixOS/nixpkgs.
Add a remote for the base repository and retry.
Current remotes:
(none)`);
  });

  test("remoteを`name\\tURL`の形で並べ、URLの認証情報は取り除く", () => {
    const error = new BaseRemoteNotFoundError({
      owner: "NixOS",
      repo: "nixpkgs",
      remotes: [
        { name: "origin", url: "https://ncaq:ghp_secret@github.com/ncaq/konoka.git" },
        { name: "other", url: "git@github.com:ncaq/dotfiles.git" },
      ],
    });
    expect(error.message).not.toContain("ghp_secret");
    expect(error.message.split("\n").slice(3)).toEqual([
      "origin\thttps://github.com/ncaq/konoka.git",
      "other\tgit@github.com:ncaq/dotfiles.git",
    ]);
  });
});

describe("AmbiguousBaseRemoteError", () => {
  test("候補のremoteを`name\\tURL`の形で並べ、URLの認証情報は取り除く", () => {
    const error = new AmbiguousBaseRemoteError({
      owner: "NixOS",
      repo: "nixpkgs",
      candidates: [
        { name: "mirror", url: "https://ncaq:ghp_secret@mirror.example.com/NixOS/nixpkgs.git" },
        { name: "upstream", url: "https://github.com/NixOS/nixpkgs.git" },
      ],
    });
    expect(error.message).not.toContain("ghp_secret");
    expect(error.message.split("\n").slice(3)).toEqual([
      "mirror\thttps://mirror.example.com/NixOS/nixpkgs.git",
      "upstream\thttps://github.com/NixOS/nixpkgs.git",
    ]);
  });
});

describe("parseRepoInfo", () => {
  test("gh repo viewのJSONをデコードしてowner/repo/defaultBranchを取り出す", () => {
    const json = JSON.stringify({
      owner: { login: "ncaq" },
      name: "konoka",
      defaultBranchRef: { name: "master" },
    });
    expect(Effect.runSync(parseRepoInfo(json))).toEqual({
      owner: "ncaq",
      repo: "konoka",
      defaultBranch: "master",
    });
  });

  test("必須フィールドが欠けている場合は`Schema`の`SchemaError`で失敗する", () => {
    const json = JSON.stringify({ owner: { login: "ncaq" }, name: "konoka" });
    const exit = Effect.runSyncExit(parseRepoInfo(json));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.findErrorOption(exit.cause);
      expect(Option.isSome(failure) && Schema.isSchemaError(failure.value)).toBe(true);
    }
  });

  test("フィールド型が違う場合も`Schema`の`SchemaError`で失敗する", () => {
    const json = JSON.stringify({
      owner: { login: 123 },
      name: "konoka",
      defaultBranchRef: { name: "master" },
    });
    const exit = Effect.runSyncExit(parseRepoInfo(json));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.findErrorOption(exit.cause);
      expect(Option.isSome(failure) && Schema.isSchemaError(failure.value)).toBe(true);
    }
  });

  test("JSONとしてパースできない文字列も`Schema`の`SchemaError`で失敗する", () => {
    const exit = Effect.runSyncExit(parseRepoInfo("not json"));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.findErrorOption(exit.cause);
      expect(Option.isSome(failure) && Schema.isSchemaError(failure.value)).toBe(true);
    }
  });
});
