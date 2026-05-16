import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { NodeContext } from "@effect/platform-node";
import { describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach, beforeEach, expect } from "vitest";
import { prepareEditmsg } from "../src/prepare-editmsg";

describe("prepareEditmsg", () => {
  let runtimeDir: string;

  beforeEach(async () => {
    runtimeDir = await mkdtemp(join(tmpdir(), "konoka-pr-prepare-"));
  });

  afterEach(async () => {
    await rm(runtimeDir, { recursive: true, force: true });
  });

  it.effect("PULLREQ_EDITMSGファイルのパスを返す", () =>
    prepareEditmsg({ runtimeDir }).pipe(
      Effect.tap((path) => {
        expect(path.endsWith("/PULLREQ_EDITMSG")).toBe(true);
      }),
      Effect.provide(NodeContext.layer),
    ),
  );

  it.effect("セッション固有のサブディレクトリを実体として作成する", () =>
    prepareEditmsg({ runtimeDir }).pipe(
      Effect.tap((path) =>
        Effect.promise(async () => {
          const info = await stat(dirname(path));
          expect(info.isDirectory()).toBe(true);
        }),
      ),
      Effect.provide(NodeContext.layer),
    ),
  );

  it.effect("複数回呼び出しても異なるディレクトリを返す", () =>
    Effect.gen(function* () {
      const a = yield* prepareEditmsg({ runtimeDir });
      const b = yield* prepareEditmsg({ runtimeDir });
      expect(dirname(a)).not.toBe(dirname(b));
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.effect("基底ディレクトリが存在しなくても再帰的に作成する", () =>
    Effect.gen(function* () {
      const fresh = join(runtimeDir, "fresh");
      const path = yield* prepareEditmsg({ runtimeDir: fresh });
      expect(path.startsWith(fresh)).toBe(true);
      const info = yield* Effect.promise(() => stat(dirname(path)));
      expect(info.isDirectory()).toBe(true);
    }).pipe(Effect.provide(NodeContext.layer)),
  );
});
