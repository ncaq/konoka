#!/usr/bin/env node
import process from "node:process";
import { SyncBaseError, formatSyncBase, syncBase } from "../src/sync-base.ts";

/**
 * エラー型からエラーメッセージを文字列化します。
 * 特殊なエラー型からは特殊なデータを抽出します。
 */
function displayErrorMessage(err: unknown): string {
  if (err instanceof SyncBaseError) {
    return `${err.message}\n${err.stderr}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

async function main(): Promise<void> {
  try {
    const result = await syncBase();
    process.stdout.write(formatSyncBase(result));
  } catch (err: unknown) {
    console.error(displayErrorMessage(err));
    process.exitCode = 1;
    return;
  }
}

await main();
