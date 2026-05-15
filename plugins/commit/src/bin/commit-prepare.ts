import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect, Exit } from "effect";
import { prepareCommit } from "../commit-prepare";

const program = prepareCommit.pipe(
  Effect.flatMap((path) => Console.log(path)),
  Effect.catchTag("EmptyCommitError", (err) =>
    Console.error(err.message).pipe(Effect.zipRight(Effect.interrupt)),
  ),
);

NodeRuntime.runMain(program.pipe(Effect.provide(NodeContext.layer)), {
  teardown: (exit, onExit) => onExit(Exit.isSuccess(exit) ? 0 : 1),
});
