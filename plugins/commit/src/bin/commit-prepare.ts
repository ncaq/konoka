import process from "node:process";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { prepareCommit } from "../commit-prepare";

const program = prepareCommit.pipe(
  Effect.flatMap((path) => Console.log(path)),
  Effect.catchTag("EmptyCommitError", (err) =>
    Console.error(err.message).pipe(
      Effect.zipRight(
        Effect.sync(() => {
          process.exitCode = 1;
        }),
      ),
    ),
  ),
);

NodeRuntime.runMain(program.pipe(Effect.provide(NodeContext.layer)));
