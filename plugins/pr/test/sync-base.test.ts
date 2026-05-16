import { Cause, Effect, Exit, Option, ParseResult } from "effect";
import { describe, expect, test } from "vitest";
import { parseRepoInfo } from "../src/sync-base";

describe("parseRepoInfo", () => {
  test("gh repo viewのJSONをデコードしてowner/repo/baseBranchを取り出す", () => {
    const json = JSON.stringify({
      owner: { login: "ncaq" },
      name: "konoka",
      defaultBranchRef: { name: "master" },
    });
    expect(Effect.runSync(parseRepoInfo(json))).toEqual({
      owner: "ncaq",
      repo: "konoka",
      baseBranch: "master",
    });
  });

  test("必須フィールドが欠けている場合は`Schema`の`ParseError`で失敗する", () => {
    const json = JSON.stringify({ owner: { login: "ncaq" }, name: "konoka" });
    const exit = Effect.runSyncExit(parseRepoInfo(json));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(Option.isSome(failure) && ParseResult.isParseError(failure.value)).toBe(true);
    }
  });

  test("フィールド型が違う場合も`Schema`の`ParseError`で失敗する", () => {
    const json = JSON.stringify({
      owner: { login: 123 },
      name: "konoka",
      defaultBranchRef: { name: "master" },
    });
    const exit = Effect.runSyncExit(parseRepoInfo(json));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(Option.isSome(failure) && ParseResult.isParseError(failure.value)).toBe(true);
    }
  });

  test("JSONとしてパースできない文字列も`Schema`の`ParseError`で失敗する", () => {
    const exit = Effect.runSyncExit(parseRepoInfo("not json"));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(Option.isSome(failure) && ParseResult.isParseError(failure.value)).toBe(true);
    }
  });
});
