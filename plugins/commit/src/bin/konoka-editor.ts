import { spawnSync } from "node:child_process";
import process from "node:process";

const editorEnv = process.env["EDITOR"];
const [editor = "emacsclient", ...defaultArgs] = editorEnv
  ? editorEnv.split(" ")
  : ["emacsclient", "--reuse-frame", "--alternate-editor=emacs"];

const result = spawnSync(editor, [...defaultArgs, ...process.argv.slice(2)], {
  stdio: "inherit",
});

function assertEditorSuccess(
  editorName: string,
  { error, status }: { error?: Error; status: number | null },
): void {
  if (error !== undefined || status !== 0) {
    const detail = error !== undefined ? `: ${error.message}` : "";
    throw new Error(
      `Editor "${editorName}" failed (status ${status})${detail}`,
      error !== undefined ? { cause: error } : undefined,
    );
  }
}

assertEditorSuccess(editor, result);
