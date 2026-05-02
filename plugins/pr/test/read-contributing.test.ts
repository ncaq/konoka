import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { formatContributing, readContributing } from "../src/read-contributing.ts";

describe("readContributing", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "konoka-pr-contributing-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("CONTRIBUTING.mdが存在しない場合はundefinedを返します", async () => {
    expect(await readContributing(root)).toBeUndefined();
  });

  test("リポジトリ直下のCONTRIBUTING.mdを読み込みます", async () => {
    await writeFile(join(root, "CONTRIBUTING.md"), "# direct\n");
    expect(await readContributing(root)).toEqual({ path: "CONTRIBUTING.md", content: "# direct\n" });
  });

  test(".github/CONTRIBUTING.mdを読み込みます", async () => {
    await mkdir(join(root, ".github"));
    await writeFile(join(root, ".github/CONTRIBUTING.md"), "# github dir\n");
    expect(await readContributing(root)).toEqual({
      path: ".github/CONTRIBUTING.md",
      content: "# github dir\n",
    });
  });

  test("複数候補が存在する場合は.github/CONTRIBUTING.mdを優先します", async () => {
    await mkdir(join(root, ".github"));
    await writeFile(join(root, "CONTRIBUTING.md"), "# direct\n");
    await writeFile(join(root, ".github/CONTRIBUTING.md"), "# github dir\n");
    const file = await readContributing(root);
    expect(file?.path).toBe(".github/CONTRIBUTING.md");
  });
});

describe("formatContributing", () => {
  test("ファイルパスを見出しとして整形します", () => {
    expect(formatContributing({ path: "CONTRIBUTING.md", content: "body\n" })).toBe("# CONTRIBUTING.md\n\nbody\n");
  });
});
