import { NodeServices, NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { prepareCommit } from "../commit-prepare";

const program = prepareCommit.pipe(
  Effect.tapErrorTag("EmptyCommitError", (err) => Console.error(err.message)),
);

function main(): void {
  NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
}

main();
