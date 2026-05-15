import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { prepareEditmsg } from "../src/prepare-editmsg";

describe("prepareEditmsg", () => {
  let runtimeDir: string;

  beforeEach(async () => {
    runtimeDir = await mkdtemp(join(tmpdir(), "konoka-pr-prepare-"));
  });

  afterEach(async () => {
    await rm(runtimeDir, { recursive: true, force: true });
  });

  test("PULLREQ_EDITMSGファイルのパスを返します", async () => {
    const path = await prepareEditmsg({ runtimeDir });
    expect(path.endsWith("/PULLREQ_EDITMSG")).toBe(true);
  });

  test("セッション固有のサブディレクトリを実体として作成します", async () => {
    const path = await prepareEditmsg({ runtimeDir });
    const info = await stat(dirname(path));
    expect(info.isDirectory()).toBe(true);
  });

  test("複数回呼び出しても異なるディレクトリを返します", async () => {
    const a = await prepareEditmsg({ runtimeDir });
    const b = await prepareEditmsg({ runtimeDir });
    expect(dirname(a)).not.toBe(dirname(b));
  });

  test("基底ディレクトリが存在しなくても再帰的に作成します", async () => {
    const fresh = join(runtimeDir, "fresh");
    const path = await prepareEditmsg({ runtimeDir: fresh });
    expect(path.startsWith(fresh)).toBe(true);
    const info = await stat(dirname(path));
    expect(info.isDirectory()).toBe(true);
  });
});
