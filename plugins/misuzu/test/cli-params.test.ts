import { NodeServices } from "@effect/platform-node";
import { describe, it } from "@effect/vitest";
import { Effect, Option, Ref } from "effect";
import { Argument, Command } from "effect/cli";
import { expect } from "vitest";
import { dryRunFlag, prUrlArgument } from "../src/cli-params";

/**
 * フラグや引数の定義だけを検証するため、
 * ハンドラがパース結果を`Ref`に書き込むだけの最小のコマンドを組み立てて実行します。
 */
function parseWith<const Config extends Command.Command.Config>(
  config: Config,
  args: readonly string[],
): Effect.Effect<Command.Command.Config.Infer<Config>, unknown, never> {
  return Effect.gen(function* () {
    const captured = yield* Ref.make<Option.Option<Command.Command.Config.Infer<Config>>>(
      Option.none(),
    );
    const command = Command.make("probe", config, (input) => Ref.set(captured, Option.some(input)));
    yield* Command.runWith(command, { version: "0.0.0", renderErrors: false })(args);
    const result = yield* Ref.get(captured);
    if (Option.isNone(result)) {
      return yield* Effect.die(new Error("handler was not invoked"));
    }
    return result.value;
  }).pipe(Effect.provide(NodeServices.layer));
}

describe("dryRunFlag", () => {
  const params = { dryRun: dryRunFlag, json: Argument.String("json") };

  it.effect("省略時は`false`になる", () =>
    Effect.gen(function* () {
      const input = yield* parseWith(params, ["json"]);
      expect(input.dryRun).toBe(false);
      expect(input.json).toBe("json");
    }),
  );

  it.effect("`--dry-run`を指定すると`true`になる", () =>
    Effect.gen(function* () {
      const input = yield* parseWith(params, ["--dry-run", "json"]);
      expect(input.dryRun).toBe(true);
    }),
  );

  it.effect("`--dry-run`を引数の後に置いても`true`になる", () =>
    Effect.gen(function* () {
      const input = yield* parseWith(params, ["json", "--dry-run"]);
      expect(input.dryRun).toBe(true);
    }),
  );
});

describe("prUrlArgument", () => {
  const params = { prUrl: prUrlArgument };

  it.effect("省略時は`Option.none`になる", () =>
    Effect.gen(function* () {
      const input = yield* parseWith(params, []);
      expect(Option.isNone(input.prUrl)).toBe(true);
    }),
  );

  it.effect("指定するとその文字列を`Option.some`で受け取る", () =>
    Effect.gen(function* () {
      const url = "https://github.com/ncaq/konoka/pull/520";
      const input = yield* parseWith(params, [url]);
      expect(input.prUrl).toEqual(Option.some(url));
    }),
  );
});
