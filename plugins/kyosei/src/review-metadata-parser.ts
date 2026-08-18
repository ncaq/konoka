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

/**
 * `[{text}]({url})`形式のMarkdownリンクから表示テキストだけを取り出す。
 * フッターはリンク付きで出力されるが、
 * 復元したいのはリンク先ではなく表示されている値そのもの。
 * 1行ずつ切り出した文字列に対して使うため、走査に改行は含めない。
 */
const markdownLinkText: P.Parser<C.Char, string> = pipe(
  C.char("["),
  P.apSecond(P.manyTill(C.notChar("\n"), C.char("]"))),
  P.apFirst(C.char("(")),
  P.apFirst(P.manyTill(C.notChar("\n"), C.char(")"))),
  P.map((chars) => chars.join("")),
);

/**
 * 1行分の値にリンクパーサーを適用して、表示テキストと消費しきれなかった残りを返す。
 * リンクとして閉じていなければ`Option.none`。
 */
function runMarkdownLink(line: string): Option.Option<{ text: string; rest: string }> {
  const result = markdownLinkText(stream(line.split(""), 0));
  if (!isRight(result)) {
    return Option.none();
  }
  return Option.some({
    text: result.right.value,
    rest: line.slice(result.right.next.cursor),
  });
}

/**
 * 行末までの文字列を値として解釈する。
 *
 * - リンクとして閉じていて行がそこで終わっていれば、その表示テキストが値。
 * - リンクとして閉じているのに後ろに文字が残っている行は壊れたフッターなのでパース失敗にする。
 *   壊れた行を正常な値として復元するより、通常レビューへフォールバックする方が安全なため。
 * - そもそもリンクとして閉じていなければ、行末までをそのままプレーンな値として扱う。
 *   リンクを貼らない項目や、リンク導入前に投稿された過去のレビューがこの経路になる。
 */
const linkedOrPlainValue: P.Parser<C.Char, string> = pipe(
  restOfLine,
  P.chain((line) =>
    Option.match(runMarkdownLink(line), {
      onNone: () => P.succeed<C.Char, string>(line),
      onSome: ({ text, rest }) =>
        rest === "" ? P.succeed<C.Char, string>(text) : P.fail<C.Char, string>(),
    }),
  ),
);

/**
 * `- {label}: {value}\n`の1行をパースして value を返す。
 * 値が`[表示テキスト](URL)`形式のときは表示テキストを返す。
 */
function labeledLine(label: string): P.Parser<C.Char, string> {
  return pipe(S.string(`- ${label}: `), P.apSecond(linkedOrPlainValue), P.apFirst(newline));
}

/**
 * `#{number}`形式のテキストからPR番号を取り出す。
 * `#`が無い場合や前後に余計な文字が付いている場合は、
 * 数値化せずパース失敗として扱う。
 */
function toPrNumber(text: string): P.Parser<C.Char, number> {
  const digits = text.startsWith("#") ? text.slice(1) : "";
  const parsed = Number.parseInt(digits, 10);
  return String(parsed) === digits ? P.succeed(parsed) : P.fail();
}

/**
 * `- PR: #{number}\n`の1行から数値を取り出す。
 * 値は`labeledLine`を通すため、リンク形式の`- PR: [#{number}](URL)`も受け付ける。
 * 数値化できない値の場合はパース失敗になる。
 */
const prLine: P.Parser<C.Char, number> = pipe(labeledLine("PR"), P.chain(toPrNumber));

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
  const {
    commit,
    pr,
    kyoseiVersion,
    kyoseiActionVersion,
    claudeCodeVersion,
    model,
    executionInfo,
  } = result.right.value;
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
