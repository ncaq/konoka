import { FileSystem, Path } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { describe, it } from "@effect/vitest";
import { ConfigProvider, Effect } from "effect";
import { expect, test, vi } from "vitest";
import { createWorkdirPath, timestamp } from "../src/create-workdir";

describe("timestamp", () => {
  test("ISO 8601風のフォーマットを返す", () => {
    const ts = timestamp();
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
  });
  test("現在の日時に基づいたタイムスタンプを返す", () => {
    vi.useFakeTimers({ now: new Date(2026, 0, 5, 9, 3, 7) });
    try {
      expect(timestamp()).toBe("2026-01-05T09-03-07");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("createWorkdirPath", () => {
  it.scoped("`XDG_RUNTIME_DIR`配下のcoding-agent-work/commitに作業ディレクトリを作る", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const base = yield* fs.makeTempDirectoryScoped();
      const workdir = yield* createWorkdirPath.pipe(
        Effect.withConfigProvider(ConfigProvider.fromMap(new Map([["XDG_RUNTIME_DIR", base]]))),
      );
      expect(workdir.startsWith(path.join(base, "coding-agent-work", "commit"))).toBe(true);
      // 実際にディレクトリとして作成されていることを確認します。
      expect((yield* fs.stat(workdir)).type).toBe("Directory");
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("ディレクトリ名にタイムスタンプのprefixが付く", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const base = yield* fs.makeTempDirectoryScoped();
      const workdir = yield* createWorkdirPath.pipe(
        Effect.withConfigProvider(ConfigProvider.fromMap(new Map([["XDG_RUNTIME_DIR", base]]))),
      );
      expect(path.basename(workdir)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-/);
    }).pipe(Effect.provide(NodeContext.layer)),
  );
});
