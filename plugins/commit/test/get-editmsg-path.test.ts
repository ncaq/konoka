import { NodeServices } from "@effect/platform-node";
import { describe, it } from "@effect/vitest";
import { FileSystem, Effect } from "effect";
import { expect } from "vitest";
import { getEditmsgPath } from "../src/get-editmsg-path";

describe("getEditmsgPath", () => {
  it.effect("workdir直下のCOMMIT_EDITMSGのパスを返し、ファイルは作成しない", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const dir = yield* fs.makeTempDirectoryScoped();
      const editmsgPath = yield* getEditmsgPath(dir);
      expect(editmsgPath).toBe(`${dir}/COMMIT_EDITMSG`);
      expect(yield* fs.exists(editmsgPath)).toBe(false);
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});
