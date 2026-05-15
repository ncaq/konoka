import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  formatPullRequestTemplates,
  readPullRequestTemplates,
} from "../src/read-pull-request-template";

describe("readPullRequestTemplates", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "konoka-pr-template-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("テンプレートが存在しない場合は空配列を返します", async () => {
    expect(await readPullRequestTemplates(root)).toEqual([]);
  });

  test(".github/pull_request_template.mdを読み込みます", async () => {
    await mkdir(join(root, ".github"));
    await writeFile(join(root, ".github/pull_request_template.md"), "default body\n");
    expect(await readPullRequestTemplates(root)).toEqual([
      { path: ".github/pull_request_template.md", content: "default body\n" },
    ]);
  });

  test("PULL_REQUEST_TEMPLATEディレクトリ配下の.mdファイルを全て読み込みます", async () => {
    await mkdir(join(root, ".github/PULL_REQUEST_TEMPLATE"), { recursive: true });
    await writeFile(join(root, ".github/PULL_REQUEST_TEMPLATE/bug.md"), "bug template\n");
    await writeFile(join(root, ".github/PULL_REQUEST_TEMPLATE/feature.md"), "feature template\n");
    await writeFile(join(root, ".github/PULL_REQUEST_TEMPLATE/skip.txt"), "ignored\n");

    const templates = await readPullRequestTemplates(root);
    const paths = templates.map((t) => t.path).sort();
    expect(paths).toEqual([
      ".github/PULL_REQUEST_TEMPLATE/bug.md",
      ".github/PULL_REQUEST_TEMPLATE/feature.md",
    ]);
  });

  test("単一テンプレートと複数テンプレートが両方ある場合は全てを返します", async () => {
    await mkdir(join(root, ".github/PULL_REQUEST_TEMPLATE"), { recursive: true });
    await writeFile(join(root, ".github/pull_request_template.md"), "default\n");
    await writeFile(join(root, ".github/PULL_REQUEST_TEMPLATE/bug.md"), "bug\n");

    const templates = await readPullRequestTemplates(root);
    expect(templates).toHaveLength(2);
  });
});

describe("formatPullRequestTemplates", () => {
  test("各テンプレートを区切り線で連結します", () => {
    const result = formatPullRequestTemplates([
      { path: "a.md", content: "A\n" },
      { path: "b.md", content: "B\n" },
    ]);
    expect(result).toBe("# a.md\n\nA\n\n\n---\n\n# b.md\n\nB\n");
  });

  test("空配列の場合は空文字列を返します", () => {
    expect(formatPullRequestTemplates([])).toBe("");
  });
});
