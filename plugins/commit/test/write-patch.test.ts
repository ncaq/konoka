import { Effect } from "effect";
import { describe, expect, test } from "vitest";
import { EmptyCommitError, hasStagedChanges } from "../src/write-patch";

describe("EmptyCommitError", () => {
  test("Errorを継承している", () => {
    const error = new EmptyCommitError({ message: "test message" });
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(EmptyCommitError);
  });

  test("メッセージを保持する", () => {
    const error = new EmptyCommitError({ message: "No changes to commit." });
    expect(error.message).toBe("No changes to commit.");
  });

  test("Effect.catchTagで捕捉できる", () => {
    const program = Effect.fail(new EmptyCommitError({ message: "caught" })).pipe(
      Effect.catchTag("EmptyCommitError", (err) => Effect.succeed(err.message)),
    );
    expect(Effect.runSync(program)).toBe("caught");
  });
});

describe("hasStagedChanges", () => {
  test("ステージ済みの新規ファイルを検出する", () => {
    expect(hasStagedChanges("A  new-file.ts")).toBe(true);
  });

  test("ステージ済みの変更ファイルを検出する", () => {
    expect(hasStagedChanges("M  modified-file.ts")).toBe(true);
  });

  test("ステージ済みの削除ファイルを検出する", () => {
    expect(hasStagedChanges("D  deleted-file.ts")).toBe(true);
  });

  test("ステージ済みのリネームファイルを検出する", () => {
    expect(hasStagedChanges("R  old-name.ts -> new-name.ts")).toBe(true);
  });

  test("ステージ済みのコピーファイルを検出する", () => {
    expect(hasStagedChanges("C  src.ts -> dest.ts")).toBe(true);
  });

  test("未追跡ファイルのみの場合はfalse", () => {
    expect(hasStagedChanges("?? untracked-file.ts")).toBe(false);
  });

  test("ワークツリーの変更のみの場合はfalse", () => {
    expect(hasStagedChanges(" M unstaged-file.ts")).toBe(false);
  });

  test("ステージ済みと未ステージの混在を検出する", () => {
    const status = " M unstaged.ts\nM  staged.ts\n?? untracked.ts";
    expect(hasStagedChanges(status)).toBe(true);
  });

  test("空文字列の場合はfalse", () => {
    expect(hasStagedChanges("")).toBe(false);
  });

  test("末尾に空行がある場合でも正しく検出する", () => {
    expect(hasStagedChanges("M  file.ts\n")).toBe(true);
  });
});
