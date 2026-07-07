import { type CommandExecutor } from "@effect/platform";
import { it } from "@effect/vitest";
import { Effect } from "effect";
import type { Octokit } from "octokit";
import { describe, expect } from "vitest";
import { detectReviewContext } from "../src/context";
import { FakeCommandError, fakeCommandExecutor } from "./fake-command";

const dummyOctokit = {} as Octokit;

const failingCommandLayer = fakeCommandExecutor(() =>
  Effect.fail(new FakeCommandError({ message: "simulated git failure" })),
);

describe("detectReviewContext", () => {
  // PR URLでない引数はローカル解決にフォールスルーするので、フェイクgitが失敗することでrejectされます。
  it.layer(failingCommandLayer)((it) => {
    const expectFailure = (
      argument: string | undefined,
    ): Effect.Effect<void, never, CommandExecutor.CommandExecutor> =>
      detectReviewContext(dummyOctokit, argument).pipe(
        // 成功してしまった場合はテストの前提が崩れているので`die`させて落とします。
        Effect.flip,
        Effect.orDie,
        Effect.tap((err) => Effect.sync(() => expect(err).toBeInstanceOf(Error))),
        Effect.asVoid,
      );

    it.effect("undefinedの場合はローカル解決にフォールスルーする", () => expectFailure(undefined));
    it.effect("空文字の場合はローカル解決にフォールスルーする", () => expectFailure(""));
    it.effect("空白のみの場合はローカル解決にフォールスルーする", () => expectFailure("   "));
    it.effect("URLではない文字列の場合はローカル解決にフォールスルーする", () =>
      expectFailure("not-a-url"),
    );
    it.effect("PR URLではないGitHub URLの場合はローカル解決にフォールスルーする", () =>
      expectFailure("https://github.com/ncaq/konoka"),
    );
    it.effect("issueのURLの場合はローカル解決にフォールスルーする", () =>
      expectFailure("https://github.com/ncaq/konoka/issues/42"),
    );
    it.effect("PR番号が0の場合はローカル解決にフォールスルーする", () =>
      expectFailure("https://github.com/ncaq/konoka/pull/0"),
    );
    it.effect("PR番号が負の場合はローカル解決にフォールスルーする", () =>
      expectFailure("https://github.com/ncaq/konoka/pull/-1"),
    );
    it.effect("PR番号が数値でない場合はローカル解決にフォールスルーする", () =>
      expectFailure("https://github.com/ncaq/konoka/pull/abc"),
    );
  });
});
