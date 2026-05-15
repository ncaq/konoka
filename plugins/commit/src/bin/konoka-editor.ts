import process from "node:process";
import { Args, Command as CliCommand } from "@effect/cli";
import { Command } from "@effect/platform";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Config, Effect } from "effect";

const defaultEditor = ["emacsclient", "--reuse-frame", "--alternate-editor=emacs"] as const;

const editorParts: Effect.Effect<readonly string[]> = Config.nonEmptyString("EDITOR").pipe(
  Effect.map((s) => s.split(" ")),
  Effect.orElseSucceed(() => defaultEditor),
);

const commitEditmsgArg = Args.file({ name: "COMMIT_EDITMSG", exists: "yes" });

const command = CliCommand.make("konoka-editor", { commitEditmsgArg }, ({ commitEditmsgArg }) =>
  Effect.gen(function* () {
    const [editor, ...defaultArgs] = yield* editorParts;
    if (editor == null) {
      return yield* Effect.dieMessage("Editor command is empty");
    }
    const cmd = Command.make(editor, ...defaultArgs, commitEditmsgArg).pipe(
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
