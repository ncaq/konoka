import process from "node:process";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect, Option } from "effect";
import { readCommitInstructions } from "../read-commit-instructions";

const program = readCommitInstructions.pipe(
  Effect.flatMap((content) =>
    Option.match(content, {
      onNone: () => Effect.void,
      onSome: (text) =>
        Effect.sync(() => {
          process.stdout.write(text);
        }),
    }),
  ),
);

function main(): void {
  NodeRuntime.runMain(program.pipe(Effect.provide(NodeContext.layer)));
}

main();
