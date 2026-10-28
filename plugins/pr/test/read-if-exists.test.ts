import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { describe, it } from "@effect/vitest";
import { Effect, Option, Result } from "effect";
import { isPlatformError } from "effect/PlatformError";
import { afterEach, beforeEach, expect } from "vitest";
import { findCaseInsensitive, readdirIfExists, readIfExists } from "../src/read-if-exists";

describe("read-if-exists", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "konoka-pr-read-if-exists-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  describe("readIfExists", () => {
    it.effect("存在するファイルは内容を`Option.some`で返す", () =>
      Effect.gen(function* () {
        yield* Effect.promise(() => writeFile(join(root, "file.md"), "content\n"));
        const result = yield* readIfExists(join(root, "file.md"));
        expect(result).toEqual(Option.some("content\n"));
      }).pipe(Effect.provide(NodeServices.layer)),
    );

    it.effect("存在しないパスは`Option.none`を返す", () =>
      Effect.gen(function* () {
        const result = yield* readIfExists(join(root, "missing.md"));
        expect(Option.isNone(result)).toBe(true);
      }).pipe(Effect.provide(NodeServices.layer)),
    );

    it.effect("ディレクトリを渡した場合はNotFound以外の`PlatformError`なので伝播する", () =>
      Effect.gen(function* () {
        yield* Effect.promise(() => mkdir(join(root, "dir")));
        const result = yield* Effect.result(readIfExists(join(root, "dir")));
        expect(Result.isFailure(result)).toBe(true);
        if (Result.isFailure(result)) {
          expect(isPlatformError(result.failure)).toBe(true);
        }
      }).pipe(Effect.provide(NodeServices.layer)),
    );
  });

  describe("readdirIfExists", () => {
    it.effect("存在するディレクトリはエントリを`Option.some`で返す", () =>
      Effect.gen(function* () {
        yield* Effect.promise(() => writeFile(join(root, "a.md"), ""));
        const result = yield* readdirIfExists(root);
        expect(result).toEqual(Option.some(["a.md"]));
      }).pipe(Effect.provide(NodeServices.layer)),
    );

    it.effect("存在しないパスは`Option.none`を返す", () =>
      Effect.gen(function* () {
        const result = yield* readdirIfExists(join(root, "missing"));
        expect(Option.isNone(result)).toBe(true);
      }).pipe(Effect.provide(NodeServices.layer)),
    );

    it.effect("ファイルを渡した場合はNotFound以外の`PlatformError`なので伝播する", () =>
      Effect.gen(function* () {
        yield* Effect.promise(() => writeFile(join(root, "file.md"), ""));
        const result = yield* Effect.result(readdirIfExists(join(root, "file.md")));
        expect(Result.isFailure(result)).toBe(true);
        if (Result.isFailure(result)) {
          expect(isPlatformError(result.failure)).toBe(true);
        }
      }).pipe(Effect.provide(NodeServices.layer)),
    );
  });

  describe("findCaseInsensitive", () => {
    it.effect("大文字小文字の違いを無視して実際のファイル名を返す", () =>
      Effect.gen(function* () {
        yield* Effect.promise(() => writeFile(join(root, "Contributing.MD"), ""));
        const result = yield* findCaseInsensitive(root, "CONTRIBUTING.md");
        expect(result).toEqual(Option.some("Contributing.MD"));
      }).pipe(Effect.provide(NodeServices.layer)),
    );

    it.effect("ディレクトリが存在しない場合は`Option.none`を返す", () =>
      Effect.gen(function* () {
        const result = yield* findCaseInsensitive(join(root, "missing"), "CONTRIBUTING.md");
        expect(Option.isNone(result)).toBe(true);
      }).pipe(Effect.provide(NodeServices.layer)),
    );
  });
});
