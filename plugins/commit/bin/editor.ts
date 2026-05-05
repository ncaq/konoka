#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import process from "node:process";

const editorEnv = process.env["EDITOR"];
const [editor = "emacsclient", ...defaultArgs] = editorEnv
  ? editorEnv.split(" ")
  : ["emacsclient", "--reuse-frame", "--alternate-editor=emacs"];

const result = spawnSync(editor, [...defaultArgs, ...process.argv.slice(2)], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
