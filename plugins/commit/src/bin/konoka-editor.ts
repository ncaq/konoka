import process from "node:process";
import { Command } from "@effect/platform";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Config, Effect } from "effect";

const defaultEditor = ["emacsclient", "--reuse-frame", "--alternate-editor=emacs"] as const;

const editorParts: Effect.Effect<readonly string[]> = Config.nonEmptyString("EDITOR").pipe(
  Effect.map((s) => s.split(" ")),
  Effect.orElseSucceed(() => defaultEditor),
);

const program = Effect.gen(function* () {
  const [editor, ...defaultArgs] = yield* editorParts;
  if (editor == null) {
    return yield* Effect.dieMessage("Editor command is empty");
  }
  const args = [...defaultArgs, ...process.argv.slice(2)];
  const cmd = Command.make(editor, ...args).pipe(
    Command.stdin("inherit"),
    Command.stdout("inherit"),
    Command.stderr("inherit"),
  );
  const exitCode = yield* Command.exitCode(cmd);
  if (exitCode !== 0) {
    return yield* Effect.dieMessage(`Editor "${editor}" failed (status ${exitCode})`);
  }
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeContext.layer)));
