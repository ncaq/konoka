import { describe, expect, it } from "vitest";
import { parseAheadBehind, parseOpenPr } from "../src/push-head";
import { CommandError } from "../src/run";

describe("parseAheadBehind", () => {
  it("git rev-list --left-right --countの出力をパースします", () => {
    expect(parseAheadBehind("0\t3")).toEqual({ behind: 0, ahead: 3 });
    expect(parseAheadBehind("2\t5")).toEqual({ behind: 2, ahead: 5 });
  });

  it("空白区切り(スペース)でもパースします", () => {
    expect(parseAheadBehind("1 2")).toEqual({ behind: 1, ahead: 2 });
  });

  it("不正な出力では例外を投げます", () => {
    expect(() => parseAheadBehind("foo")).toThrow(CommandError);
    expect(() => parseAheadBehind("1\tbar")).toThrow(CommandError);
  });
});

describe("parseOpenPr", () => {
  it("空配列の場合はundefinedを返します", () => {
    expect(parseOpenPr("[]")).toBeUndefined();
  });

  it("PR番号を取り出します", () => {
    expect(parseOpenPr('[{"number":42}]')).toEqual({ number: 42 });
  });

  it("複数件あっても先頭1件を返します", () => {
    expect(parseOpenPr('[{"number":1},{"number":2}]')).toEqual({ number: 1 });
  });

  it("number以外のフィールドが入っていても無視されます", () => {
    expect(parseOpenPr('[{"number":7,"title":"x"}]')).toEqual({ number: 7 });
  });

  it("numberが数値でない場合は例外を投げます", () => {
    expect(() => parseOpenPr('[{"number":"42"}]')).toThrow(CommandError);
  });
});
