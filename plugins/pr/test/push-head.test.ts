import { Cause, Effect, Exit, Option, ParseResult } from "effect";
import { describe, expect, test } from "vitest";
import { parseAheadBehind, parseOpenPr, RevListParseError } from "../src/push-head";

describe("parseAheadBehind", () => {
  test("git rev-list --left-right --countの出力をパースする", () => {
    expect(Effect.runSync(parseAheadBehind("0\t3"))).toEqual({ behind: 0, ahead: 3 });
    expect(Effect.runSync(parseAheadBehind("2\t5"))).toEqual({ behind: 2, ahead: 5 });
  });

  test("空白区切り(スペース)でもパースする", () => {
    expect(Effect.runSync(parseAheadBehind("1 2"))).toEqual({ behind: 1, ahead: 2 });
  });

  test("不正な出力は`RevListParseError`で失敗する", () => {
    const exit = Effect.runSyncExit(parseAheadBehind("foo"));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(Option.isSome(failure) && failure.value instanceof RevListParseError).toBe(true);
    }
  });

  test("片方が数値でない場合も`RevListParseError`で失敗する", () => {
    const exit = Effect.runSyncExit(parseAheadBehind("1\tbar"));
    expect(Exit.isFailure(exit)).toBe(true);
  });
});

describe("parseOpenPr", () => {
  test("空配列の場合は`Option.none`を返す", () => {
    expect(Effect.runSync(parseOpenPr("[]"))).toEqual(Option.none());
  });

  test("PR番号を取り出す", () => {
    expect(Effect.runSync(parseOpenPr('[{"number":42}]'))).toEqual(Option.some({ number: 42 }));
  });

  test("複数件あっても先頭1件を返す", () => {
    expect(Effect.runSync(parseOpenPr('[{"number":1},{"number":2}]'))).toEqual(
      Option.some({ number: 1 }),
    );
  });

  test("number以外のフィールドが入っていても無視される", () => {
    expect(Effect.runSync(parseOpenPr('[{"number":7,"title":"x"}]'))).toEqual(
      Option.some({ number: 7 }),
    );
  });

  test("numberが数値でない場合は`Schema`の`ParseError`で失敗する", () => {
    const exit = Effect.runSyncExit(parseOpenPr('[{"number":"42"}]'));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(Option.isSome(failure) && ParseResult.isParseError(failure.value)).toBe(true);
    }
  });

  test("JSONとしてパースできない文字列も`Schema`の`ParseError`で失敗する", () => {
    const exit = Effect.runSyncExit(parseOpenPr("not json"));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(Option.isSome(failure) && ParseResult.isParseError(failure.value)).toBe(true);
    }
  });
});
