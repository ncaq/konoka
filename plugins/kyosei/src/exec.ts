/**
 * `execFile`のPromise版。
 * 複数モジュールで共有するために切り出しています。
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const execFileAsync: typeof execFile.__promisify__ = promisify(execFile);
