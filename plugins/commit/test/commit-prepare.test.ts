import { Effect } from "effect";
import { describe, expect, test, vi } from "vitest";
import {
  EmptyCommitError,
  buildEditmsgTemplate,
  hasStagedChanges,
  timestamp,
} from "../src/commit-prepare";

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

describe("buildEditmsgTemplate", () => {
  test("scissors lineとdiffを含むテンプレートを生成する", () => {
    const diff = "diff --git a/file.ts b/file.ts\n+added line" as const;
    const template = buildEditmsgTemplate(diff);
    const scissors = "# ------------------------ >8 ------------------------" as const;
    expect(template).toContain(scissors);
    expect(template).toContain(diff);
    const scissorsIndex = template.indexOf(scissors);
    const diffIndex = template.indexOf(diff);
    expect(scissorsIndex).toBeLessThan(diffIndex);
  });

  test("テンプレートの先頭は空行で始まる", () => {
    const template = buildEditmsgTemplate("diff");
    expect(template.startsWith("\n")).toBe(true);
  });
});

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
