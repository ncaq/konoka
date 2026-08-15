import { FileSystem, Path } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { ConfigProvider, Effect } from "effect";
import { describe, expect } from "vitest";
import { writeRespondInfoFiles, type RespondInfo } from "../src/respond-info-files";

const githubRespondInfo: RespondInfo = {
  context: {
    output: "github",
    host: "github.com",
    pr: { owner: "test", repo: "repo", prNumber: 1 },
    focus: { kind: "review", databaseId: 123 },
  },
  conversation: {
    title: "Test PR",
    body: "Body",
    author: "test-user",
    url: "https://github.com/test/repo/pull/1",
    comments: [],
    reviews: [],
    reviewThreads: [],
  },
};

const localRespondInfo: RespondInfo = {
  context: { output: "local", baseBranch: "master" },
};

describe("writeRespondInfoFiles", () => {
  it.scoped("`RUNNER_TEMP`を`XDG_RUNTIME_DIR`より優先する", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const runnerTemp = yield* fs.makeTempDirectoryScoped();
      const xdgRuntimeDirectory = yield* fs.makeTempDirectoryScoped();
      const filePaths = yield* writeRespondInfoFiles(localRespondInfo).pipe(
        Effect.withConfigProvider(
          ConfigProvider.fromMap(
            new Map([
              ["RUNNER_TEMP", runnerTemp],
              ["XDG_RUNTIME_DIR", xdgRuntimeDirectory],
            ]),
          ),
        ),
      );

      expect(filePaths.context.startsWith(path.join(runnerTemp, "coding-agent-work"))).toBe(true);
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("対応情報を用途別のファイルへ書き出す", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const runtimeDirectory = yield* fs.makeTempDirectoryScoped();
      const filePaths = yield* writeRespondInfoFiles(githubRespondInfo).pipe(
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map([["XDG_RUNTIME_DIR", runtimeDirectory]])),
        ),
      );

      const expectedDirectory = path.join(runtimeDirectory, "coding-agent-work", "misuzu");
      expect(path.dirname(path.dirname(filePaths.context))).toBe(expectedDirectory);
      expect(path.basename(path.dirname(filePaths.context))).toMatch(/^respond-info-/);
      expect(path.isAbsolute(filePaths.context)).toBe(true);
      expect(path.basename(filePaths.context)).toBe("context.json");
      expect(path.basename(filePaths.conversation ?? "")).toBe("conversation.json");

      expect(JSON.parse(yield* fs.readFileString(filePaths.context))).toEqual(
        githubRespondInfo.context,
      );
      expect(JSON.parse(yield* fs.readFileString(filePaths.conversation ?? ""))).toEqual(
        githubRespondInfo.conversation,
      );
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("conversationがない場合はファイルとパスを省略する", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const runtimeDirectory = yield* fs.makeTempDirectoryScoped();
      const filePaths = yield* writeRespondInfoFiles(localRespondInfo).pipe(
        Effect.withConfigProvider(
          ConfigProvider.fromMap(new Map([["XDG_RUNTIME_DIR", runtimeDirectory]])),
        ),
      );

      expect(filePaths).not.toHaveProperty("conversation");
      expect(JSON.parse(yield* fs.readFileString(filePaths.context))).toEqual(
        localRespondInfo.context,
      );
    }).pipe(Effect.provide(NodeContext.layer)),
  );

  it.scoped("呼び出しごとに一意な作業ディレクトリを作る", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const runtimeDirectory = yield* fs.makeTempDirectoryScoped();
      const configProvider = ConfigProvider.fromMap(
        new Map([["XDG_RUNTIME_DIR", runtimeDirectory]]),
      );
      const [first, second] = yield* Effect.all(
        [writeRespondInfoFiles(localRespondInfo), writeRespondInfoFiles(localRespondInfo)],
        { concurrency: "unbounded" },
      ).pipe(Effect.withConfigProvider(configProvider));

      expect(path.dirname(first.context)).not.toBe(path.dirname(second.context));
    }).pipe(Effect.provide(NodeContext.layer)),
  );
});
