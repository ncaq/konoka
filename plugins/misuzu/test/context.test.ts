import { type CommandExecutor } from "@effect/platform";
import { it } from "@effect/vitest";
import { Effect } from "effect";
import type { Octokit } from "octokit";
import { describe, expect } from "vitest";
import { detectRespondContext, InvalidPrUrlArgument } from "../src/context";
import { FakeCommandError, fakeCommandExecutor } from "./fake-command";

const dummyOctokit = {} as Octokit;

const failingCommandLayer = fakeCommandExecutor(() =>
  Effect.fail(new FakeCommandError({ message: "simulated git failure" })),
);

describe("detectRespondContext", () => {
  it.layer(failingCommandLayer)((it) => {
    // 引数なしの場合のみローカル解決にフォールスルーするので、
    // フェイクgitが失敗することでrejectされます。
    const expectLocalFallthrough = (
      argument: string | undefined,
    ): Effect.Effect<void, never, CommandExecutor.CommandExecutor> =>
      detectRespondContext(dummyOctokit, argument).pipe(
        // 成功してしまった場合はテストの前提が崩れているので`die`させて落とします。
        Effect.flip,
        Effect.orDie,
        Effect.tap((err) => Effect.sync(() => expect(err).toBeInstanceOf(FakeCommandError))),
        Effect.asVoid,
      );

    // PR URLとして解釈できない引数はローカル解決に落とさずエラーになります。
    const expectInvalidArgument = (
      argument: string,
    ): Effect.Effect<void, never, CommandExecutor.CommandExecutor> =>
      detectRespondContext(dummyOctokit, argument).pipe(
        Effect.flip,
        Effect.orDie,
        Effect.tap((err) => Effect.sync(() => expect(err).toBeInstanceOf(InvalidPrUrlArgument))),
        Effect.asVoid,
      );

    it.effect("undefinedの場合はローカル解決にフォールスルーする", () =>
      expectLocalFallthrough(undefined),
    );
    it.effect("空文字の場合はローカル解決にフォールスルーする", () => expectLocalFallthrough(""));
    it.effect("空白のみの場合はローカル解決にフォールスルーする", () =>
      expectLocalFallthrough("   "),
    );
    it.effect("URLではない文字列の場合はエラーになる", () => expectInvalidArgument("not-a-url"));
    it.effect("PR URLではないGitHub URLの場合はエラーになる", () =>
      expectInvalidArgument("https://github.com/ncaq/konoka"),
    );
    it.effect("issueのURLの場合はエラーになる", () =>
      expectInvalidArgument("https://github.com/ncaq/konoka/issues/42"),
    );
    it.effect("PR番号が0の場合はエラーになる", () =>
      expectInvalidArgument("https://github.com/ncaq/konoka/pull/0"),
    );
    it.effect("PR番号が負の場合はエラーになる", () =>
      expectInvalidArgument("https://github.com/ncaq/konoka/pull/-1"),
    );
    it.effect("PR番号が数値でない場合はエラーになる", () =>
      expectInvalidArgument("https://github.com/ncaq/konoka/pull/abc"),
    );
  });
});
