import process from "node:process";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect, Option } from "effect";
import { formatContributing, readContributing } from "../read-contributing";

const program = readContributing().pipe(
  Effect.flatMap((file) =>
    Option.match(file, {
      onNone: () => Effect.void,
      onSome: (f) =>
        Effect.sync(() => {
          process.stdout.write(formatContributing(f));
        }),
    }),
  ),
);

NodeRuntime.runMain(program.pipe(Effect.provide(NodeContext.layer)));
