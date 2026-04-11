import { describe, expect, test } from "vitest";
import { EmptyCommitError, buildEditmsgTemplate, hasStagedChanges, timestamp } from "../lib/commit-prepare.ts";

describe("timestamp", () => {
  test("ISO 8601風のフォーマットを返す", () => {
    const ts = timestamp();
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
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
});

describe("buildEditmsgTemplate", () => {
  test("scissors lineとdiffを含むテンプレートを生成する", () => {
    const diff = "diff --git a/file.ts b/file.ts\n+added line";
    const template = buildEditmsgTemplate(diff);
    expect(template).toContain("# ------------------------ >8 ------------------------");
    expect(template).toContain(diff);
  });

  test("テンプレートの先頭は空行で始まる", () => {
    const template = buildEditmsgTemplate("diff");
    expect(template.startsWith("\n")).toBe(true);
  });
});

describe("EmptyCommitError", () => {
  test("Errorを継承している", () => {
    const error = new EmptyCommitError("test message");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(EmptyCommitError);
  });

  test("メッセージを保持する", () => {
    const error = new EmptyCommitError("No changes to commit.");
    expect(error.message).toBe("No changes to commit.");
  });
});
