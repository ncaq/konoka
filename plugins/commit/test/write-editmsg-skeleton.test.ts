import { FileSystem } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";
import { writeEditmsgSkeleton } from "../src/write-editmsg-skeleton";

describe("writeEditmsgSkeleton", () => {
  it.scoped("workdir直下に空のCOMMIT_EDITMSGを作成してそのパスを返す", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const dir = yield* fs.makeTempDirectoryScoped();
      const editmsgPath = yield* writeEditmsgSkeleton(dir);
      expect(editmsgPath).toBe(`${dir}/COMMIT_EDITMSG`);
      expect(yield* fs.readFileString(editmsgPath)).toBe("");
    }).pipe(Effect.provide(NodeContext.layer)),
  );
});
