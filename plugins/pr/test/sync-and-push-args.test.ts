import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";
import { InvalidArgumentsError, parseSyncAndPushArgs } from "../src/sync-and-push-args";

describe("parseSyncAndPushArgs", () => {
  it.each<[string, readonly string[], Option.Option<string>]>([
    ["引数なし", [], Option.none()],
    ["空文字だけ", [""], Option.none()],
    ["確認モードだけ", ["auto"], Option.none()],
    ["確認モードが両方", ["manual", "auto"], Option.none()],
    ["baseだけ", ["staging"], Option.some("staging")],
    ["確認モードの後にbase", ["auto", "release-26.05"], Option.some("release-26.05")],
    ["baseの後に確認モード", ["haskell-updates", "manual"], Option.some("haskell-updates")],
    ["確認モードを部分的に含むブランチ名", ["auto-deploy"], Option.some("auto-deploy")],
  ])("%s", (_, argv, expected) => {
    expect(Effect.runSync(parseSyncAndPushArgs(argv))).toEqual({ base: expected });
  });

  it("baseの候補が2つ以上ある場合は`InvalidArgumentsError`で失敗する", () => {
    const exit = Effect.runSyncExit(parseSyncAndPushArgs(["auto", "staging", "master"]));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.findErrorOption(exit.cause);
      expect(Option.isSome(failure) && failure.value instanceof InvalidArgumentsError).toBe(true);
      if (Option.isSome(failure)) {
        expect(failure.value.candidates).toEqual(["staging", "master"]);
      }
    }
  });
});
