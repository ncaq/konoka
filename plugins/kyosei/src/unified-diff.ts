/**
 * unified diffを解析するモジュール。
 * `git diff`やGitHub APIが返す生のdiffと、
 * get-review-infoが書き出す行番号付きのdiffの両方を扱います。
 *
 * 文法はparser-tsのパーサコンビネータで入力全体に対して記述しています。
 * 構造(`DiffFile`)だけでなく、元の文字列を復元できる文書木(`DiffDocument`)も返すため、
 * 行番号付きパッチの生成(`numbered-patch.ts`)はこの文書木を描画し直すだけで済みます。
 * レビューコメントの行番号検証(`review-comment-lines.ts`)は構造の方を使います。
 */

import { Array as Arr, Chunk, Option } from "effect";
import { isRight } from "fp-ts/Either";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/function";
import * as PR from "parser-ts/ParseResult";
import * as P from "parser-ts/Parser";
import { type Stream, stream } from "parser-ts/Stream";
import * as C from "parser-ts/char";
import * as S from "parser-ts/string";

// 構造。

/**
 * hunk内の1行。
 * 文脈行は旧・新の両方、追加行は新、削除行は旧の行番号だけを持ちます。
 * `content`は先頭の` `/`+`/`-`を除いた本文です。
 */
export type DiffLine =
  | {
      readonly kind: "context";
      readonly content: string;
      readonly oldLine: number;
      readonly newLine: number;
    }
  | { readonly kind: "add"; readonly content: string; readonly newLine: number }
  | { readonly kind: "delete"; readonly content: string; readonly oldLine: number };

/** hunkヘッダ`@@ -a[,b] +c[,d] @@`の数値部分。 */
export interface HunkHeader {
  readonly oldStart: number;
  /** `@@ -1 +1 @@`のように省略された場合は1。 */
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
}

/** 1つのhunk。 */
export interface DiffHunk extends HunkHeader {
  /** `@@ ... @@`行全体(末尾の関数名ヒントを含む)。 */
  readonly header: string;
  readonly lines: readonly DiffLine[];
}

/** ファイルの中身の差分。バイナリにはhunkがありません。 */
export type FileContent =
  | { readonly kind: "text"; readonly hunks: readonly DiffHunk[] }
  | { readonly kind: "binary" };

/**
 * 1ファイル分の差分。
 * `path`はGitHubがレビューコメントの`path`として扱うパスで、
 * 削除ファイルでは旧パス、それ以外では新パスです。
 * `a/` `b/`のプレフィクスとクォートは除去済みです。
 */
export type DiffFile =
  | { readonly kind: "added"; readonly path: string; readonly content: FileContent }
  | { readonly kind: "deleted"; readonly path: string; readonly content: FileContent }
  | { readonly kind: "modified"; readonly path: string; readonly content: FileContent }
  | {
      readonly kind: "renamed";
      readonly oldPath: string;
      readonly path: string;
      readonly content: FileContent;
    };

/**
 * 入力の形式。
 * `numbered`はhunk内の各行の先頭に`numberDiff`が付けた行番号があるものとして、
 * それを読み飛ばしてから分類します。
 */
export type DiffFormat = "raw" | "numbered";

// 文書木。構造に加えて元の文字列を保持します。

/** hunk内の本文1行と、行番号を除いた元の行(先頭のマーカーを含む)。 */
export type DocumentLine = DiffLine & { readonly raw: string };

/** hunk本文の1行。本文行か、`\ No newline at end of file`の印のどちらかです。 */
export type HunkBodyLine = DocumentLine | { readonly kind: "noNewline"; readonly raw: string };

/** hunkヘッダ行とその本文。 */
export interface DocumentHunk extends HunkHeader {
  /** `@@ ... @@`行全体。 */
  readonly header: string;
  readonly lines: readonly HunkBodyLine[];
}

/**
 * hunkより前にあるファイル単位のヘッダ行1つ。解釈結果と元の行を持ちます。
 * `oldPath`/`newPath`行の`path`が`none`なのは`/dev/null`、つまりそちら側にファイルが無い場合です。
 */
export type HeaderLine =
  | {
      readonly kind: "fileStart";
      readonly raw: string;
      readonly oldPath: Option.Option<string>;
      readonly newPath: Option.Option<string>;
    }
  | { readonly kind: "oldPath"; readonly raw: string; readonly path: Option.Option<string> }
  | { readonly kind: "newPath"; readonly raw: string; readonly path: Option.Option<string> }
  | { readonly kind: "renameFrom"; readonly raw: string; readonly path: string }
  | { readonly kind: "renameTo"; readonly raw: string; readonly path: string }
  | { readonly kind: "binary"; readonly raw: string }
  | { readonly kind: "other"; readonly raw: string };

/** 1ファイル分の文書木。 */
export interface DocumentFile {
  readonly headers: readonly HeaderLine[];
  readonly hunks: readonly DocumentHunk[];
}

/** diff全体の文書木。元の文字列を復元できます。 */
export interface DiffDocument {
  readonly files: readonly DocumentFile[];
  /** 入力が改行で終わっていたか。 */
  readonly trailingNewline: boolean;
}

// 文字単位の基本パーサ。

/**
 * 改行までの文字列。改行自体も消費します。
 * CRLFの`\r`は行の一部にしません。
 * 入力は`parseDiffDocument`で必ず改行終端に正規化されるため、改行の無い行は失敗にします。
 *
 * diffの大半は本文行なので、ここだけはライブラリの`item`と同じ層の基本パーサとして直接書いています。
 * `C.many(C.notChar("\n"))`で1文字ずつ組み立てると、数MBのdiffで秒単位の差が出るためです。
 */
const restOfLine: P.Parser<C.Char, string> = (input: Stream<C.Char>) => {
  const { buffer, cursor } = input;
  const end = buffer.indexOf("\n", cursor);
  if (end < 0) {
    return PR.error(input, ["line terminated by newline"]);
  }
  const line = buffer.slice(cursor, end).join("");
  return PR.success(line.endsWith("\r") ? line.slice(0, -1) : line, stream(buffer, end + 1), input);
};

/** 行全体の元の文字列を`raw`として控えてから、同じ行を`parser`で解釈します。 */
function withRaw<A>(parser: P.Parser<C.Char, A>): P.Parser<C.Char, { raw: string; value: A }> {
  return pipe(
    P.lookAhead(restOfLine),
    P.bindTo("raw"),
    P.bind("value", () => parser),
  );
}

/** `parser`が先読みで成功する位置では失敗します。否定先読み。 */
function notFollowedBy<A>(parser: P.Parser<C.Char, A>): P.Parser<C.Char, void> {
  return pipe(
    P.optional(P.lookAhead(parser)),
    P.chain((found) => (O.isSome(found) ? P.fail<C.Char, void>() : P.succeed(undefined))),
  );
}

/** 符号なし10進整数。`S.int`は負号も受け付けてしまい削除行の`-`と衝突するため使いません。 */
const unsignedInt: P.Parser<C.Char, number> = pipe(
  C.many1(C.digit),
  P.map((digits) => Number.parseInt(digits, 10)),
);

// hunkヘッダ。

/** hunkヘッダの`start[,count]`。countの省略時は1。 */
const hunkRange: P.Parser<C.Char, { readonly start: number; readonly count: number }> = pipe(
  unsignedInt,
  P.bindTo("start"),
  P.bind("count", () =>
    pipe(
      C.char(","),
      P.apSecond(unsignedInt),
      P.alt(() => P.succeed<C.Char, number>(1)),
    ),
  ),
);

/** `@@ -a[,b] +c[,d] @@`の数値部分。末尾の関数名ヒントは読みません。 */
const hunkHeaderNumbers: P.Parser<C.Char, HunkHeader> = pipe(
  S.string("@@ -"),
  P.apSecond(hunkRange),
  P.bindTo("older"),
  P.apFirst(S.string(" +")),
  P.bind("newer", () => hunkRange),
  P.apFirst(S.string(" @@")),
  P.map(({ older, newer }) => ({
    oldStart: older.start,
    oldLines: older.count,
    newStart: newer.start,
    newLines: newer.count,
  })),
);

/** hunkヘッダ行。数値部分と行全体を返します。 */
const hunkHeaderLine: P.Parser<C.Char, { raw: string; value: HunkHeader }> = withRaw(
  pipe(hunkHeaderNumbers, P.apFirst(restOfLine)),
);

/** hunkヘッダ行なら数値部分を返します。 */
export function parseHunkHeader(line: string): Option.Option<HunkHeader> {
  const result = hunkHeaderLine(stream(`${line}\n`.split(""), 0));
  return isRight(result) ? Option.some(result.right.value.value) : Option.none();
}

// ファイルヘッダのパス。

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** 8進数字。 */
const octalDigit: P.Parser<C.Char, number> = pipe(
  C.oneOf("01234567"),
  P.map((digit) => Number.parseInt(digit, 8)),
);

/** `\ooo`形式の8進エスケープ1バイト分。 */
const octalEscape: P.Parser<C.Char, number[]> = pipe(
  octalDigit,
  P.bindTo("first"),
  P.bind("second", () => octalDigit),
  P.bind("third", () => octalDigit),
  P.map(({ first, second, third }) => [first * 64 + second * 8 + third]),
);

const simpleEscapeBytes: Readonly<Record<string, number>> = {
  '"': 0x22,
  "\\": 0x5c,
  a: 0x07,
  b: 0x08,
  f: 0x0c,
  n: 0x0a,
  r: 0x0d,
  t: 0x09,
  v: 0x0b,
};

/** `\n`や`\"`のような1文字エスケープ。 */
const simpleEscape: P.Parser<C.Char, number[]> = pipe(
  P.item<C.Char>(),
  P.chain((c) => {
    const byte = simpleEscapeBytes[c];
    return byte == null ? P.fail<C.Char, number[]>() : P.succeed([byte]);
  }),
);

/** クォート内の1文字分のバイト列。 */
const quotedChar: P.Parser<C.Char, number[]> = pipe(
  C.char("\\"),
  P.apSecond(
    pipe(
      octalEscape,
      P.alt(() => simpleEscape),
    ),
  ),
  P.alt(() =>
    pipe(
      C.notOneOf('"\n'),
      P.map((c) => [...textEncoder.encode(c)]),
    ),
  ),
);

/**
 * gitの`core.quotePath`形式でクォートされたパス。
 * 非ASCIIは8進エスケープのバイト列で来るため、バイト列を集めてからUTF-8として復元します。
 */
const quotedPath: P.Parser<C.Char, string> = pipe(
  C.char('"'),
  P.apSecond(P.many(quotedChar)),
  P.apFirst(C.char('"')),
  P.map((chunks) => textDecoder.decode(Uint8Array.from(chunks.flat()))),
);

/** クォートなしのパス。GNU diff形式のタブ以降(タイムスタンプ)は読みません。 */
const plainPath: P.Parser<C.Char, string> = C.many1(C.notOneOf("\t\n"));

/** `/dev/null`は存在しないファイルを表すため`none`。 */
const devNull: P.Parser<C.Char, Option.Option<string>> = pipe(
  S.string("/dev/null"),
  P.map(() => Option.none()),
);

/** `--- `/`+++ `の後ろ、または`rename from `/`rename to `の後ろのパス。 */
const headerPath: P.Parser<C.Char, Option.Option<string>> = pipe(
  devNull,
  P.alt(() => pipe(quotedPath, P.map(Option.some))),
  P.alt(() => pipe(plainPath, P.map(Option.some))),
);

/** 先頭の`a/`や`b/`のようなプレフィクスを1回だけ取り除きます。 */
function stripPrefix(path: string, prefix: string): string {
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

/** `lead`で始まり、パスの後ろに何が続いても行末まで読み飛ばす行。 */
function pathLine(lead: string, prefix: string): P.Parser<C.Char, Option.Option<string>> {
  return pipe(
    S.string(lead),
    P.apSecond(headerPath),
    P.apFirst(restOfLine),
    P.map(Option.map((path) => stripPrefix(path, prefix))),
  );
}

/** `diff --git`行から読み取った新旧のパス。 */
interface DiffGitPaths {
  readonly oldPath: Option.Option<string>;
  readonly newPath: Option.Option<string>;
}

/**
 * `diff --git a/X b/Y`のクォートなしの部分からパスを推定します。
 * パスに空白が含まれると分割位置が一意に決まらないため、
 * `---`/`+++`や`rename from/to`がある場合はそちらを優先します。
 */
function splitDiffGitPaths(rest: string): DiffGitPaths {
  // `a/X b/X`のように同じパスが並ぶ場合は、全体の長さから一意に切り出せます。
  const separatorLength = " ".length;
  const bodyLength = rest.length - "a/".length - separatorLength - "b/".length;
  if (bodyLength > 0 && bodyLength % 2 === 0) {
    const half = bodyLength / 2;
    const oldCandidate = rest.slice("a/".length, "a/".length + half);
    const newCandidate = rest.slice("a/".length + half + separatorLength + "b/".length);
    if (rest.startsWith("a/") && oldCandidate === newCandidate) {
      return { oldPath: Option.some(oldCandidate), newPath: Option.some(newCandidate) };
    }
  }
  const separator = rest.lastIndexOf(" b/");
  if (separator < 0) {
    return { oldPath: Option.none(), newPath: Option.none() };
  }
  return {
    oldPath: Option.some(stripPrefix(rest.slice(0, separator), "a/")),
    newPath: Option.some(rest.slice(separator + " b/".length)),
  };
}

/** `diff --git`行のパス部分。両方クォートされていればそのまま読み、そうでなければ推定します。 */
const diffGitPaths: P.Parser<C.Char, DiffGitPaths> = pipe(
  quotedPath,
  P.bindTo("oldPath"),
  P.apFirst(C.char(" ")),
  P.bind("newPath", () => quotedPath),
  P.apFirst(restOfLine),
  P.map(({ oldPath, newPath }) => ({
    oldPath: Option.some(stripPrefix(oldPath, "a/")),
    newPath: Option.some(stripPrefix(newPath, "b/")),
  })),
  P.alt(() => pipe(restOfLine, P.map(splitDiffGitPaths))),
);

// ファイルヘッダ行。

const fileStartLine: P.Parser<C.Char, HeaderLine> = pipe(
  withRaw(pipe(S.string("diff --git "), P.apSecond(diffGitPaths))),
  P.map(({ raw, value }) => ({ kind: "fileStart", raw, ...value })),
);

const oldPathLine: P.Parser<C.Char, HeaderLine> = pipe(
  withRaw(pathLine("--- ", "a/")),
  P.map(({ raw, value }) => ({ kind: "oldPath", raw, path: value })),
);

const newPathLine: P.Parser<C.Char, HeaderLine> = pipe(
  withRaw(pathLine("+++ ", "b/")),
  P.map(({ raw, value }) => ({ kind: "newPath", raw, path: value })),
);

/** `rename from`/`rename to`。パスが読めなければただのヘッダ行として扱います。 */
function renameLine(lead: string, kind: "renameFrom" | "renameTo"): P.Parser<C.Char, HeaderLine> {
  return pipe(
    withRaw(pathLine(lead, "")),
    P.map(
      ({ raw, value }): HeaderLine =>
        Option.match(value, {
          onNone: () => ({ kind: "other", raw }),
          onSome: (path) => ({ kind, raw, path }),
        }),
    ),
  );
}

const binaryLine: P.Parser<C.Char, HeaderLine> = pipe(
  withRaw(
    pipe(
      S.string("Binary files "),
      P.alt(() => S.string("GIT binary patch")),
      P.apFirst(restOfLine),
    ),
  ),
  P.map(({ raw }) => ({ kind: "binary", raw })),
);

/** 意味を持たないヘッダ行(`index`, `new file mode`など)。ファイルやhunkの始まりは含みません。 */
const otherHeaderLine: P.Parser<C.Char, HeaderLine> = pipe(
  notFollowedBy(S.string("diff --git ")),
  P.apSecond(notFollowedBy(hunkHeaderNumbers)),
  P.apSecond(restOfLine),
  P.map((raw) => ({ kind: "other", raw })),
);

/** `diff --git`以外のファイルヘッダ行。 */
const headerLine: P.Parser<C.Char, HeaderLine> = pipe(
  oldPathLine,
  P.alt(() => newPathLine),
  P.alt(() => renameLine("rename from ", "renameFrom")),
  P.alt(() => renameLine("rename to ", "renameTo")),
  P.alt(() => binaryLine),
  P.alt(() => otherHeaderLine),
);

// hunk本文。

/** 行番号付きdiffで各行の先頭に付いている行番号と区切りの空白。 */
const lineNumberPrefix: P.Parser<C.Char, number> = pipe(
  C.many(C.char(" ")),
  P.apSecond(unsignedInt),
  P.apFirst(C.char(" ")),
);

/** `\ No newline at end of file`行。 */
const noNewlineLine: P.Parser<C.Char, string> = pipe(
  P.lookAhead(C.char("\\")),
  P.apSecond(restOfLine),
);

/**
 * hunk本文を読み進めている間の状態。`chainRec`のループ変数です。
 * 読み終えた行は、配列に毎回追加して複製すると行数の二乗の時間がかかるため、
 * 末尾への追加が定数時間の永続構造である`Chunk`で持ちます。
 */
interface HunkBodyState {
  readonly oldLine: number;
  readonly newLine: number;
  readonly oldRemaining: number;
  readonly newRemaining: number;
  readonly lines: Chunk.Chunk<HunkBodyLine>;
}

/** 本文1行の元の文字列を、先頭のマーカーで分類した結果。行番号はまだ付いていません。 */
interface MarkedLine {
  readonly kind: DiffLine["kind"];
  readonly raw: string;
  readonly content: string;
}

/**
 * 本文1行。行番号付き形式では先頭の行番号を読み飛ばします。
 * 一部のツールは空の文脈行の先頭の空白を落とすため、空行も文脈行として扱います。
 */
/**
 * 行番号の付いていない本文1行。先頭のマーカーで分類します。
 * 一部のツールは空の文脈行の先頭の空白を落とすため、空行も文脈行として扱います。
 */
const rawMarkedLine: P.Parser<C.Char, MarkedLine> = pipe(
  restOfLine,
  P.chain((raw) => {
    const marker = raw.slice(0, 1);
    const content = raw.slice(1);
    switch (marker) {
      case "-": {
        return P.succeed<C.Char, MarkedLine>({ kind: "delete", raw, content });
      }
      case "+": {
        return P.succeed<C.Char, MarkedLine>({ kind: "add", raw, content });
      }
      case " ":
      case "": {
        return P.succeed<C.Char, MarkedLine>({ kind: "context", raw, content });
      }
      default: {
        return P.fail<C.Char, MarkedLine>();
      }
    }
  }),
);

/**
 * 本文1行。
 * 行番号付き形式では、行番号を読んでから本文を分類する分岐を先に試し、
 * 失敗したら行番号なしの分岐に戻ります。
 * `P.optional`で行番号だけを任意にすると、
 * 生のdiffの` 42 foo`のような文脈行で行番号の読み取りだけが成功してしまい、
 * その後のマーカー判定に失敗しても行番号なしの分岐には戻れないためです。
 * `P.alt`は失敗時に元の位置から次の分岐を試すので、
 * 行番号付きのパッチに生のdiffの行が混ざっていてもベストエフォートで読めます。
 */
function markedLine(format: DiffFormat): P.Parser<C.Char, MarkedLine> {
  if (format === "raw") {
    return rawMarkedLine;
  }
  return pipe(
    lineNumberPrefix,
    P.apSecond(rawMarkedLine),
    P.alt(() => rawMarkedLine),
  );
}

/** 残り行数と矛盾しない本文行だけを受け付け、行番号を付けて状態を進めます。 */
function advance(state: HunkBodyState, line: MarkedLine): Option.Option<HunkBodyState> {
  const { raw, content } = line;
  switch (line.kind) {
    case "delete": {
      if (state.oldRemaining === 0) {
        return Option.none();
      }
      return Option.some({
        ...state,
        oldLine: state.oldLine + 1,
        oldRemaining: state.oldRemaining - 1,
        lines: Chunk.append(state.lines, { kind: "delete", raw, content, oldLine: state.oldLine }),
      });
    }
    case "add": {
      if (state.newRemaining === 0) {
        return Option.none();
      }
      return Option.some({
        ...state,
        newLine: state.newLine + 1,
        newRemaining: state.newRemaining - 1,
        lines: Chunk.append(state.lines, { kind: "add", raw, content, newLine: state.newLine }),
      });
    }
    case "context": {
      if (state.oldRemaining === 0 || state.newRemaining === 0) {
        return Option.none();
      }
      return Option.some({
        oldLine: state.oldLine + 1,
        newLine: state.newLine + 1,
        oldRemaining: state.oldRemaining - 1,
        newRemaining: state.newRemaining - 1,
        lines: Chunk.append(state.lines, {
          kind: "context",
          raw,
          content,
          oldLine: state.oldLine,
          newLine: state.newLine,
        }),
      });
    }
  }
}

/**
 * hunk本文。ヘッダの行数を残りとして数えながら読み、両方が尽きたら終わります。
 * 本文に`--- foo`のような削除行があっても、残りが尽きるまではファイルヘッダとは誤認しません。
 * 残りと矛盾する行(壊れたdiff)が来た場合はそこで本文を打ち切り、以降は通常の行として扱います。
 */
function hunkBody(
  header: HunkHeader,
  format: DiffFormat,
): P.Parser<C.Char, readonly HunkBodyLine[]> {
  type Step = E.Either<HunkBodyState, readonly HunkBodyLine[]>;
  const bodyLine = markedLine(format);
  const initial: HunkBodyState = {
    oldLine: header.oldStart,
    newLine: header.newStart,
    oldRemaining: header.oldLines,
    newRemaining: header.newLines,
    lines: Chunk.empty(),
  };
  return P.ChainRec.chainRec<C.Char, HunkBodyState, readonly HunkBodyLine[]>(initial, (state) => {
    // 配列への変換は本文の長さに比例するため、毎ステップではなく終了が確定した時だけ行います。
    const finish = pipe(
      P.succeed<C.Char, undefined>(undefined),
      P.map((): Step => E.right(Chunk.toReadonlyArray(state.lines))),
    );
    const noNewline = pipe(
      noNewlineLine,
      P.map(
        (raw): Step =>
          E.left({ ...state, lines: Chunk.append(state.lines, { kind: "noNewline", raw }) }),
      ),
    );
    if (state.oldRemaining === 0 && state.newRemaining === 0) {
      return pipe(
        noNewline,
        P.alt(() => finish),
      );
    }
    const next = pipe(
      bodyLine,
      P.chain((line) =>
        Option.match(advance(state, line), {
          onNone: () => P.fail<C.Char, Step>(),
          onSome: (advanced) => P.succeed<C.Char, Step>(E.left(advanced)),
        }),
      ),
    );
    return pipe(
      noNewline,
      P.alt(() => next),
      P.alt(() => finish),
    );
  });
}

/** hunkヘッダ行とその本文。 */
function hunk(format: DiffFormat): P.Parser<C.Char, DocumentHunk> {
  return pipe(
    hunkHeaderLine,
    P.chain(({ raw, value }) =>
      pipe(
        hunkBody(value, format),
        P.map((lines) => ({ ...value, header: raw, lines })),
      ),
    ),
  );
}

// ファイルと文書。

/**
 * 1ファイル分。
 * `diff --git`で始まる通常の形式のほか、
 * `---`から始まるplainなunified diffや、ヘッダ無しでhunkだけが続く断片も受け付けます。
 * どの形でも1行以上消費するため、`many`で繰り返しても止まります。
 */
function file(format: DiffFormat): P.Parser<C.Char, DocumentFile> {
  const hunks = P.many(hunk(format));
  const withStart = pipe(
    fileStartLine,
    P.bindTo("start"),
    P.bind("headers", () => P.many(headerLine)),
    P.bind("hunks", () => hunks),
    P.map(({ start, headers, hunks }) => ({ headers: [start, ...headers], hunks })),
  );
  const withoutStart = pipe(
    P.many1(headerLine),
    P.bindTo("headers"),
    P.bind("hunks", () => hunks),
  );
  const hunksOnly = pipe(
    P.many1(hunk(format)),
    P.map((hunks) => ({ headers: [], hunks })),
  );
  return pipe(
    withStart,
    P.alt<C.Char, DocumentFile>(() => withoutStart),
    P.alt<C.Char, DocumentFile>(() => hunksOnly),
  );
}

/** diff全体を文書木として解析します。 */
export function parseDiffDocument(diff: string, format: DiffFormat): DiffDocument {
  const trailingNewline = diff.endsWith("\n");
  // 全ての行を改行終端に揃えることで、行パーサが末尾の行だけ特別扱いせずに済みます。
  const normalized = diff === "" || trailingNewline ? diff : `${diff}\n`;
  const document = pipe(P.many(file(format)), P.apFirst(P.eof<C.Char>()));
  const result = document(stream(normalized.split(""), 0));
  if (!isRight(result)) {
    // `otherHeaderLine`が任意の行を受け付けるため、ここに来るのは文法の欠陥です。
    throw new Error(`unified diff could not be parsed at offset ${result.left.input.cursor}`);
  }
  return { files: result.right.value, trailingNewline };
}

/**
 * ヘッダ行の列から片側のパスを決めます。
 * `---`/`+++`行があればそれが正で、`/dev/null`ならそちら側にファイルは無いと分かります。
 * 無ければ`rename from/to`、さらに無ければ`diff --git`行からの推定に頼ります。
 */
function resolvePath(
  headers: readonly HeaderLine[],
  fromPathHeader: (header: HeaderLine) => Option.Option<Option.Option<string>>,
  fromRename: (header: HeaderLine) => Option.Option<string>,
  fromFileStart: (header: HeaderLine) => Option.Option<string>,
): Option.Option<string> {
  return pipe(
    Arr.findLast(headers, fromPathHeader),
    Option.orElse(() => Option.map(Arr.findLast(headers, fromRename), Option.some)),
    Option.orElse(() => Option.map(Arr.findLast(headers, fromFileStart), Option.some)),
    Option.flatten,
  );
}

/** 文書木の1ファイルを構造に変換します。パスが一つも分からないものはファイルとみなしません。 */
function toDiffFile(documentFile: DocumentFile): Option.Option<DiffFile> {
  const { headers, hunks } = documentFile;
  const content: FileContent = headers.some((header) => header.kind === "binary")
    ? { kind: "binary" }
    : {
        kind: "text",
        hunks: hunks.map(({ oldStart, oldLines, newStart, newLines, header, lines }) => ({
          oldStart,
          oldLines,
          newStart,
          newLines,
          header,
          lines: Arr.getSomes(
            lines.map((line): Option.Option<DiffLine> => {
              switch (line.kind) {
                case "noNewline": {
                  return Option.none();
                }
                case "context": {
                  const { content, oldLine, newLine } = line;
                  return Option.some({ kind: "context", content, oldLine, newLine });
                }
                case "add": {
                  const { content, newLine } = line;
                  return Option.some({ kind: "add", content, newLine });
                }
                case "delete": {
                  const { content, oldLine } = line;
                  return Option.some({ kind: "delete", content, oldLine });
                }
              }
            }),
          ),
        })),
      };
  const oldPath = resolvePath(
    headers,
    (header) => (header.kind === "oldPath" ? Option.some(header.path) : Option.none()),
    (header) => (header.kind === "renameFrom" ? Option.some(header.path) : Option.none()),
    (header) => (header.kind === "fileStart" ? header.oldPath : Option.none()),
  );
  const newPath = resolvePath(
    headers,
    (header) => (header.kind === "newPath" ? Option.some(header.path) : Option.none()),
    (header) => (header.kind === "renameTo" ? Option.some(header.path) : Option.none()),
    (header) => (header.kind === "fileStart" ? header.newPath : Option.none()),
  );
  if (Option.isSome(oldPath) && Option.isSome(newPath)) {
    return Option.some(
      oldPath.value === newPath.value
        ? { kind: "modified", path: newPath.value, content }
        : { kind: "renamed", oldPath: oldPath.value, path: newPath.value, content },
    );
  }
  if (Option.isSome(newPath)) {
    return Option.some({ kind: "added", path: newPath.value, content });
  }
  if (Option.isSome(oldPath)) {
    return Option.some({ kind: "deleted", path: oldPath.value, content });
  }
  return Option.none();
}

/** 生のunified diff(`git diff`やGitHub API)を解析します。 */
export function parseUnifiedDiff(diff: string): readonly DiffFile[] {
  return Arr.getSomes(parseDiffDocument(diff, "raw").files.map(toDiffFile));
}

/**
 * 行番号付きdiff(get-review-infoの`changeset.patch`)を解析します。
 * 行番号の付いていない行も生のdiffとして読めますが、
 * 本文が「数字と空白」で始まる行は行番号付きと区別できないため、
 * 生のdiffに対する結果は保証しません。
 */
export function parseNumberedDiff(diff: string): readonly DiffFile[] {
  return Arr.getSomes(parseDiffDocument(diff, "numbered").files.map(toDiffFile));
}
