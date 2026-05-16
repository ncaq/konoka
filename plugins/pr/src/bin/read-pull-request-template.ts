import process from "node:process";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import {
  formatPullRequestTemplates,
  readPullRequestTemplates,
} from "../read-pull-request-template";

const program = readPullRequestTemplates().pipe(
  Effect.flatMap((templates) =>
    templates.length === 0
      ? Effect.void
      : Effect.sync(() => {
          process.stdout.write(formatPullRequestTemplates(templates));
        }),
  ),
);

NodeRuntime.runMain(program.pipe(Effect.provide(NodeContext.layer)));
