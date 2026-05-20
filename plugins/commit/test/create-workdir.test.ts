import { describe, expect, test, vi } from "vitest";
import { timestamp } from "../src/create-workdir";

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
