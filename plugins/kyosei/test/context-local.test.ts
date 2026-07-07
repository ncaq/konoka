import { it } from "@effect/vitest";
import { Effect } from "effect";
import type { Octokit } from "octokit";
import { describe, expect } from "vitest";
import { resolveLocalContext } from "../src/context-local";
import { FakeCommandError, fakeCommandExecutor } from "./fake-command";

const dummyOctokit = {} as Octokit;

describe("resolveLocalContext", () => {
  // ブランチ解決の入口で必ずgitが必要なので、
  // フェイクで全コマンドを失敗させてrejectされることを確認します。
  it.effect("コマンド実行が全て失敗する場合は失敗で抜ける", () =>
    resolveLocalContext(dummyOctokit).pipe(
      Effect.flip,
      Effect.tap((err) => Effect.sync(() => expect(err).toBeInstanceOf(FakeCommandError))),
      Effect.provide(
        fakeCommandExecutor(() =>
          Effect.fail(new FakeCommandError({ message: "simulated git failure" })),
        ),
      ),
    ),
  );
});
