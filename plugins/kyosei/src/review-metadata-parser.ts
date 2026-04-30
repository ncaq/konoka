/**
 * レビュー本文の末尾に付与されているメタデータフッターをパースして`MetadataSchema`相当の値に復元するモジュール。
 * `review-metadata-footer.mustache`がレンダリングしたブロックを、parser-tsのパーサーコンビネータで読み戻します。
 *
 * 復元できなくても通常レビューにフォールバックするため、厳密な失敗種別の区別はしません。
 * 失敗時は一律で`Option.none()`を返します。
 */

import { Option, Schema } from "effect";
import { isRight } from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as P from "parser-ts/Parser";
import { stream } from "parser-ts/Stream";
import * as C from "parser-ts/char";
import * as S from "parser-ts/string";
import { MetadataSchema } from "./review-metadata";

const newline = C.char("\n");

/** 改行直前までの文字列(改行は含まない)。 */
const restOfLine: P.Parser<C.Char, string> = C.many(C.notChar("\n"));

/** `<details>`ブロックを成立させるために、その手前にある任意のbody本文を読み飛ばす。 */
const skipUntilDetails: P.Parser<C.Char, string> = pipe(
  P.manyTill(P.item<C.Char>(), pipe(S.string("<details>"), P.lookAhead)),
  P.map((chars) => chars.join("")),
);

/** `- {label}: {value}\n`の1行をパースして value を返す。 */
function labeledLine(label: string): P.Parser<C.Char, string> {
  return pipe(S.string(`- ${label}: `), P.apSecond(restOfLine), P.apFirst(newline));
}

/** `- PR: #{number}\n`の値部分から数値を取り出す。 */
const prLine: P.Parser<C.Char, number> = pipe(
  S.string("- PR: #"),
  P.apSecond(S.int),
  P.apFirst(restOfLine),
  P.apFirst(newline),
);

interface ExecutionInfo {
  readonly execution: string;
  readonly runUrl?: string;
}

/** `- Execution: {execution} ([run]({url}))\n`形式 */
const executionWithRun: P.Parser<C.Char, ExecutionInfo> = pipe(
  S.string("- Execution: "),
  P.apSecond(
    pipe(
      P.manyTill(P.item<C.Char>(), pipe(S.string(" ([run]("), P.lookAhead)),
      P.bindTo("executionChars"),
      P.apFirst(S.string(" ([run](")),
      P.bind("urlChars", () => P.manyTill(P.item<C.Char>(), S.string("))"))),
      P.apFirst(newline),
      P.map(({ executionChars, urlChars }) => ({
        execution: executionChars.join(""),
        runUrl: urlChars.join(""),
      })),
    ),
  ),
);

/** `- Execution: {execution}\n`形式(runUrlなし) */
const executionPlain: P.Parser<C.Char, ExecutionInfo> = pipe(
  labeledLine("Execution"),
  P.map((execution) => ({ execution })),
);

const executionLineParser: P.Parser<C.Char, ExecutionInfo> = pipe(
  executionWithRun,
  P.alt(() => executionPlain),
);

/**
 * `<details>...</details>`ブロックを丸ごと飲み込んで、各フィールドを構造体として返す。
 * フィールドの並び順は`review-metadata-footer.mustache`に固定されているため、
 * パーサーも同じ順で固定的に走査する。
 */
const metadataBlockParser = pipe(
  skipUntilDetails,
  P.apSecond(S.string("<details>")),
  P.apSecond(newline),
  P.apSecond(S.string("<summary>Review metadata</summary>")),
  P.apSecond(newline),
  P.apSecond(newline),
  P.apSecond(labeledLine("Reviewed commit")),
  P.bindTo("commit"),
  P.bind("pr", () => prLine),
  P.bind("kyoseiVersion", () => labeledLine("kyosei")),
  P.bind("kyoseiActionVersion", () => labeledLine("kyosei-action")),
  P.bind("claudeCodeVersion", () => labeledLine("Claude Code")),
  P.bind("model", () => labeledLine("Model")),
  P.bind("executionInfo", () => executionLineParser),
);

/**
 * フッターメタデータをパースします。
 * 復元失敗時は`Option.none`を返し、呼び出し側は通常レビューにフォールバックさせます。
 */
export function parseFooterMetadata(body: string): Option.Option<typeof MetadataSchema.Type> {
  const result = metadataBlockParser(stream(body.split(""), 0));
  if (!isRight(result)) {
    return Option.none();
  }
  const { commit, pr, kyoseiVersion, kyoseiActionVersion, claudeCodeVersion, model, executionInfo } =
    result.right.value;
  const decoded = Schema.decodeUnknownEither(MetadataSchema)({
    commit,
    pr,
    kyoseiVersion,
    kyoseiActionVersion,
    claudeCodeVersion,
    model,
    execution: executionInfo.execution,
    ...(executionInfo.runUrl != null ? { runUrl: executionInfo.runUrl } : {}),
  });
  return decoded._tag === "Right" ? Option.some(decoded.right) : Option.none();
}
