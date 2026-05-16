import process from "node:process";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect, Exit } from "effect";
import { formatSyncAndPush, syncAndPush } from "../sync-and-push";

const program = syncAndPush().pipe(
  Effect.tap((result) =>
    Effect.sync(() => {
      process.stdout.write(formatSyncAndPush(result));
    }),
  ),
  // 全ての型付きエラーは`.message`に必要な情報を畳み込んでいるので、
  // ここでstderrに出して、後段の`disableErrorReporting`でEffectの冗長ログを抑制します。
  Effect.tapError((err) => Console.error(err.message)),
);

NodeRuntime.runMain(program.pipe(Effect.provide(NodeContext.layer)), {
  disableErrorReporting: true,
  teardown: (exit, onExit) => onExit(Exit.isSuccess(exit) ? 0 : 1),
});
