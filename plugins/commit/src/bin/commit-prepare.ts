import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect, Exit } from "effect";
import { prepareCommit } from "../commit-prepare";

const program = prepareCommit.pipe(
  Effect.tapErrorTag("EmptyCommitError", (err) => Console.error(err.message)),
);

NodeRuntime.runMain(program.pipe(Effect.provide(NodeContext.layer)), {
  teardown: (exit, onExit) => onExit(Exit.isSuccess(exit) ? 0 : 1),
});
