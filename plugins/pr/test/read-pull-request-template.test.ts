import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeContext } from "@effect/platform-node";
import { describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach, beforeEach, expect, test } from "vitest";
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

  it.effect("テンプレートが存在しない場合は空配列を返す", () =>
    readPullRequestTemplates(root).pipe(
      Effect.tap((templates) => {
        expect(templates).toEqual([]);
      }),
      Effect.provide(NodeContext.layer),
    ),
  );

  it.effect(".github/pull_request_template.mdを読み込む", () =>
    Effect.gen(function* () {
      yield* Effect.promise(() => mkdir(join(root, ".github")));
      yield* Effect.promise(() =>
        writeFile(join(root, ".github/pull_request_template.md"), "default body\n"),
      );
      const templates = yield* readPullRequestTemplates(root);
      expect(templates).toEqual([
        { path: ".github/pull_request_template.md", content: "default body\n" },
      ]);
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.effect("PULL_REQUEST_TEMPLATEディレクトリ配下の.mdファイルを全て読み込む", () =>
    Effect.gen(function* () {
      yield* Effect.promise(() =>
        mkdir(join(root, ".github/PULL_REQUEST_TEMPLATE"), { recursive: true }),
      );
      yield* Effect.promise(() =>
        writeFile(join(root, ".github/PULL_REQUEST_TEMPLATE/bug.md"), "bug template\n"),
      );
      yield* Effect.promise(() =>
        writeFile(join(root, ".github/PULL_REQUEST_TEMPLATE/feature.md"), "feature template\n"),
      );
      yield* Effect.promise(() =>
        writeFile(join(root, ".github/PULL_REQUEST_TEMPLATE/skip.txt"), "ignored\n"),
      );

      const templates = yield* readPullRequestTemplates(root);
      const paths = templates.map((t) => t.path).sort();
      expect(paths).toEqual([
        ".github/PULL_REQUEST_TEMPLATE/bug.md",
        ".github/PULL_REQUEST_TEMPLATE/feature.md",
      ]);
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.effect("単一テンプレートと複数テンプレートが両方ある場合は全てを返す", () =>
    Effect.gen(function* () {
      yield* Effect.promise(() =>
        mkdir(join(root, ".github/PULL_REQUEST_TEMPLATE"), { recursive: true }),
      );
      yield* Effect.promise(() =>
        writeFile(join(root, ".github/pull_request_template.md"), "default\n"),
      );
      yield* Effect.promise(() =>
        writeFile(join(root, ".github/PULL_REQUEST_TEMPLATE/bug.md"), "bug\n"),
      );

      const templates = yield* readPullRequestTemplates(root);
      expect(templates).toHaveLength(2);
    }).pipe(Effect.provide(NodeContext.layer)),
  );
});

describe("formatPullRequestTemplates", () => {
  test("各テンプレートを区切り線で連結する", () => {
    const result = formatPullRequestTemplates([
      { path: "a.md", content: "A\n" },
      { path: "b.md", content: "B\n" },
    ]);
    expect(result).toBe("# a.md\n\nA\n\n\n---\n\n# b.md\n\nB\n");
  });

  test("空配列の場合は空文字列を返す", () => {
    expect(formatPullRequestTemplates([])).toBe("");
  });
});
