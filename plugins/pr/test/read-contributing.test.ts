import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeContext } from "@effect/platform-node";
import { describe, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { afterEach, beforeEach, expect, test } from "vitest";
import { formatContributing, readContributing } from "../src/read-contributing";

describe("readContributing", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "konoka-pr-contributing-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it.effect("CONTRIBUTING.mdが存在しない場合は`Option.none`を返す", () =>
    readContributing(root).pipe(
      Effect.tap((result) => {
        expect(Option.isNone(result)).toBe(true);
      }),
      Effect.provide(NodeContext.layer),
    ),
  );

  it.effect("リポジトリ直下のCONTRIBUTING.mdを読み込む", () =>
    Effect.gen(function* () {
      yield* Effect.promise(() => writeFile(join(root, "CONTRIBUTING.md"), "# direct\n"));
      const result = yield* readContributing(root);
      expect(result).toEqual(
        Option.some({
          path: "CONTRIBUTING.md",
          content: "# direct\n",
        }),
      );
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.effect(".github/CONTRIBUTING.mdを読み込む", () =>
    Effect.gen(function* () {
      yield* Effect.promise(() => mkdir(join(root, ".github")));
      yield* Effect.promise(() =>
        writeFile(join(root, ".github/CONTRIBUTING.md"), "# github dir\n"),
      );
      const result = yield* readContributing(root);
      expect(result).toEqual(
        Option.some({
          path: ".github/CONTRIBUTING.md",
          content: "# github dir\n",
        }),
      );
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.effect("複数候補が存在する場合は.github/CONTRIBUTING.mdを優先する", () =>
    Effect.gen(function* () {
      yield* Effect.promise(() => mkdir(join(root, ".github")));
      yield* Effect.promise(() => writeFile(join(root, "CONTRIBUTING.md"), "# direct\n"));
      yield* Effect.promise(() =>
        writeFile(join(root, ".github/CONTRIBUTING.md"), "# github dir\n"),
      );
      const result = yield* readContributing(root);
      expect(Option.isSome(result) && result.value.path).toBe(".github/CONTRIBUTING.md");
    }).pipe(Effect.provide(NodeContext.layer)),
  );
});

describe("formatContributing", () => {
  test("ファイルパスを見出しとして整形する", () => {
    expect(formatContributing({ path: "CONTRIBUTING.md", content: "body\n" })).toBe(
      "# CONTRIBUTING.md\n\nbody\n",
    );
  });
});
