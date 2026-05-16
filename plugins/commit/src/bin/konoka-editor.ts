import process from "node:process";
import { Args, Command as CliCommand } from "@effect/cli";
import { Command } from "@effect/platform";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { buildEditorInvocation, editorCommand } from "../konoka-editor";

const commitEditmsgArg = Args.file({ name: "COMMIT_EDITMSG", exists: "yes" });

const command = CliCommand.make("konoka-editor", { commitEditmsgArg }, ({ commitEditmsgArg }) =>
  Effect.gen(function* () {
    const editor = yield* editorCommand;
    const [executable, ...args] = buildEditorInvocation(editor, commitEditmsgArg);
    if (executable == null) {
      return yield* Effect.dieMessage("Editor invocation is empty");
    }
    const cmd = Command.make(executable, ...args).pipe(
      Command.stdin("inherit"),
      Command.stdout("inherit"),
      Command.stderr("inherit"),
    );
    yield* Command.exitCode(cmd).pipe(
      Effect.filterOrDie(
        (code) => code === 0,
        (code) => new Error(`Editor "${editor}" failed (status ${code})`),
      ),
    );
  }),
);

const cli = CliCommand.run(command, {
  name: "konoka-editor",
  version: "0.0.0",
});

cli(process.argv).pipe(Effect.provide(NodeContext.layer), NodeRuntime.runMain);
