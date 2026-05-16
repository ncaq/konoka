import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { prepareEditmsg } from "../prepare-editmsg";

const program = prepareEditmsg().pipe(Effect.flatMap((path) => Console.log(path)));

NodeRuntime.runMain(program.pipe(Effect.provide(NodeContext.layer)));
