import { NodeServices } from "@effect/platform-node";
import { describe, it } from "@effect/vitest";
import { Cause, Effect, Exit, Option, Result } from "effect";
import { isPlatformError } from "effect/PlatformError";
import { expect } from "vitest";
import { CommandFailedError, runStdout, tryRunStdout } from "../src/run";

describe("runStdout", () => {
  it.effect("終了コード0のときはtrim済みの標準出力を返す", () =>
    Effect.gen(function* () {
      const out = yield* runStdout("sh", ["-c", "echo '  out  '"]);
      expect(out).toBe("out");
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect(
    "非0で終了したときは終了コードと標準エラー出力を含む`CommandFailedError`で失敗する",
    () =>
      Effect.gen(function* () {
        const args = ["-c", "echo out; echo err >&2; exit 3"];
        const exit = yield* Effect.exit(runStdout("sh", args));
        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          const failure = Cause.findErrorOption(exit.cause);
          expect(Option.isSome(failure)).toBe(true);
          if (Option.isSome(failure)) {
            expect(failure.value).toBeInstanceOf(CommandFailedError);
            if (failure.value instanceof CommandFailedError) {
              expect(failure.value.command).toBe("sh");
              expect(failure.value.args).toEqual(args);
              expect(failure.value.exitCode).toBe(3);
              expect(failure.value.stderr).toBe("err\n");
            }
          }
        }
      }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("存在しないコマンドは`PlatformError`で失敗する", () =>
    Effect.gen(function* () {
      const result = yield* Effect.result(runStdout("konoka-pr-no-such-command", []));
      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(isPlatformError(result.failure)).toBe(true);
      }
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});

describe("tryRunStdout", () => {
  it.effect("終了コード0のときは`Option.some`で標準出力を返す", () =>
    Effect.gen(function* () {
      const out = yield* tryRunStdout("sh", ["-c", "echo out"]);
      expect(out).toEqual(Option.some("out"));
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("非0で終了したときは`Option.none`に畳む", () =>
    Effect.gen(function* () {
      const out = yield* tryRunStdout("sh", ["-c", "exit 1"]);
      expect(Option.isNone(out)).toBe(true);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("存在しないコマンドは`PlatformError`のまま伝播する", () =>
    Effect.gen(function* () {
      const result = yield* Effect.result(tryRunStdout("konoka-pr-no-such-command", []));
      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(isPlatformError(result.failure)).toBe(true);
      }
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});
