/**
 * Markdown本文中の裸のURLをCommonMarkの自動リンク`<URL>`で囲み、
 * GitHubの自動リンクがURLの範囲を取り違えるのを防ぐモジュール。
 *
 * GitHub(GFMのautolink拡張)は裸のURLを空白まで1つのリンクとして扱います。
 * 末尾の`)`や`.`などASCIIの一部の記号は除外されますが、
 * 日本語のような非ASCII文字は除外されません。
 * そのため`(https://example.com/x)の変更点`のようにURLの直後に日本語が続くと、
 * `)の変更点`までリンクに飲み込まれて壊れたリンクになります。
 *
 * `<https://example.com/x>`の形式ならリンクの範囲が明示され、
 * GitHub上のissueやPRへの短縮表示なども裸のURLと同じ見た目のままです。
 * LLMの出力に頼らず、投稿前にこの形式へ機械的に揃えます。
 *
 * URLの終端はGFMの規則を基本にしつつ、
 * URLはASCIIで構成される(非ASCIIはパーセントエンコードされる)ことを根拠に、
 * 最初の非ASCII文字でも打ち切ります。
 * 既にリンク構文になっている箇所やコード部分は変更しません。
 */

import { isRight } from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as P from "parser-ts/Parser";
import { stream } from "parser-ts/Stream";
import * as C from "parser-ts/char";
import * as S from "parser-ts/string";

type TextParser = P.Parser<C.Char, string>;

const newline = C.char("\n");

/** 改行直前までの文字列(改行は含まない)。 */
const restOfLine: TextParser = C.many(C.notChar("\n"));

/** 改行かEOF。入力は消費せず、行末の判定にだけ使います。 */
const lineEnd: P.Parser<C.Char, void> = P.either(
  pipe(
    P.lookAhead(newline),
    P.map(() => undefined),
  ),
  () => P.eof<C.Char>(),
);

/** 1行とその末尾の改行。最終行で改行が無ければEOFを受け付けます。 */
const lineWithNewline: TextParser = pipe(
  restOfLine,
  P.chain((line) =>
    P.either(
      pipe(
        newline,
        P.map((nl) => line + nl),
      ),
      () =>
        pipe(
          P.eof<C.Char>(),
          P.map(() => line),
        ),
    ),
  ),
);

/** 条件を満たす文字列だけ受理し、満たさなければパース失敗にします。 */
function satisfying(parser: TextParser, predicate: (value: string) => boolean): TextParser {
  return pipe(
    parser,
    P.chain((value) => (predicate(value) ? P.succeed(value) : P.fail())),
  );
}

/**
 * 裸のURLとして扱う文字。
 * GFMは空白と`<`まで進みますが、URLはASCIIで構成されるため非ASCII文字で打ち切ります。
 * `>`は囲んだ後の`<URL>`を壊すため、バッククォートはコードスパンの開始として扱うため除外します。
 */
function isUrlBodyChar(c: string): boolean {
  const code = c.codePointAt(0);
  return code !== undefined && code >= 0x21 && code <= 0x7e && !["<", ">", "`"].includes(c);
}

/** URLの末尾から取り除く記号。GFMの自動リンクの除外規則に合わせています。 */
const trailingPunctuation = new Set(["?", "!", ".", ",", ":", "*", "_", "~", "'", '"']);

function countChar(text: string, target: string): number {
  return [...text].filter((c) => c === target).length;
}

function isAsciiAlphanumeric(text: string): boolean {
  return [...text].every((c) => {
    const code = c.codePointAt(0);
    return (
      code !== undefined &&
      ((code >= 0x30 && code <= 0x39) ||
        (code >= 0x41 && code <= 0x5a) ||
        (code >= 0x61 && code <= 0x7a))
    );
  });
}

/**
 * GFMの自動リンクがリンクに含めない末尾の文字を取り除きます。
 *
 * - `?!.,:*_~'"`は末尾から繰り返し取り除く
 * - `)`は開き括弧より閉じ括弧が多い時だけ取り除く(`https://example.com/Foo_(bar)`は保つ)
 * - `;`は`&amp;`のような文字実体参照の形ならその全体を、そうでなければ`;`だけを取り除く
 */
function trimAutolinkTail(url: string): string {
  const last = url.at(-1);
  if (last === undefined) {
    return url;
  }
  if (trailingPunctuation.has(last)) {
    return trimAutolinkTail(url.slice(0, -1));
  }
  if (last === ")") {
    return countChar(url, ")") > countChar(url, "(") ? trimAutolinkTail(url.slice(0, -1)) : url;
  }
  if (last === ";") {
    const ampersand = url.lastIndexOf("&");
    const entityName = url.slice(ampersand + 1, -1);
    const isEntity = ampersand !== -1 && entityName.length > 0 && isAsciiAlphanumeric(entityName);
    return trimAutolinkTail(isEntity ? url.slice(0, ampersand) : url.slice(0, -1));
  }
  return url;
}

/**
 * `letters://`から始まる、裸のURLとして扱う文字の連続。
 * 英字は貪欲に読むため、`foohttps://example.com`は`foohttps`がスキーム部になります。
 */
const schemeLikeRun: P.Parser<C.Char, { readonly scheme: string; readonly body: string }> = pipe(
  C.many1(C.letter),
  P.apFirst(S.string("://")),
  P.bindTo("scheme"),
  P.bind("body", () => C.many(P.sat(isUrlBodyChar))),
);

/** GitHubと同じく大文字小文字は区別しません。 */
function isAutolinkScheme(scheme: string): boolean {
  return ["http", "https"].includes(scheme.toLowerCase());
}

/**
 * 裸のURLを`<URL>`で囲みます。
 * リンクに含めない末尾の記号は`>`の外側へ出します。
 *
 * 以下はGitHubも自動リンクにしないので、消費はしますが囲まずにそのまま通します。
 *
 * - `http`と`https`以外のスキーム
 * - `foohttps://example.com`のように英字の直後に続くスキーム
 * - スキームだけでホストが無いもの
 */
const bareUrl: TextParser = pipe(
  schemeLikeRun,
  P.map(({ scheme, body }) => {
    const raw = `${scheme}://${body}`;
    if (!isAutolinkScheme(scheme)) {
      return raw;
    }
    const url = trimAutolinkTail(raw);
    return url.length > `${scheme}://`.length ? `<${url}>${raw.slice(url.length)}` : raw;
  }),
);

/**
 * コードスパン。開いたバッククォートと同じ長さの閉じを探します。
 * 閉じが見つからなければ失敗させ、先頭のバッククォートを普通の文字として扱わせます。
 */
const codeSpan: TextParser = pipe(
  C.many1(C.char("`")),
  P.chain((opening) =>
    pipe(
      P.manyTill(P.item<C.Char>(), S.string(opening)),
      P.map((chars) => opening + chars.join("") + opening),
    ),
  ),
);

/**
 * `<...>`で囲まれた1行内の範囲。
 * 既に`<URL>`になっている自動リンクと、`<a href="...">`のようなインラインHTMLをそのまま通します。
 */
const angleBracketed: TextParser = pipe(
  C.char("<"),
  P.apSecond(C.many(C.notOneOf("<>\n"))),
  P.apFirst(C.char(">")),
  P.map((inner) => `<${inner}>`),
);

/**
 * `[text](destination)`形式のインラインリンク。
 * リンクの中にリンクは置けないため、テキストもリンク先もそのまま通します。
 * `[!NOTE]`のようにリンクではない角括弧を誤って飲み込まないよう、テキストに角括弧と改行は含めません。
 */
const inlineLink: TextParser = pipe(
  C.char("["),
  P.apSecond(C.many(C.notOneOf("[]\n"))),
  P.bindTo("text"),
  P.apFirst(S.string("](")),
  P.bind("destination", () => C.many(C.notOneOf(")\n"))),
  P.apFirst(C.char(")")),
  P.map(({ text, destination }) => `[${text}](${destination})`),
);

/**
 * フェンスの前に置ける、空白のインデントと引用記号`>`の並び。
 * CommonMarkではインデントは3個までですが、
 * リスト項目や引用の中のフェンスはその分だけ深くインデントされるため、
 * 入れ子の深さを追わずに任意の並びを許します。
 */
const fencePrefix: TextParser = C.many(C.oneOf(" >"));

/** 同じフェンス文字を`minLength`個以上並べたもの。 */
function fenceRun(fenceChar: string, minLength: number): TextParser {
  return satisfying(C.many1(C.char(fenceChar)), (run) => run.length >= minLength);
}

/** 開始フェンスに対応する閉じフェンスの行。末尾の改行は消費しません。 */
function fenceClosing(opening: string): TextParser {
  return pipe(
    fencePrefix,
    P.bindTo("prefix"),
    P.bind("run", () => fenceRun(opening.charAt(0), opening.length)),
    P.bind("trailing", () => C.many(C.char(" "))),
    P.apFirst(lineEnd),
    P.map(({ prefix, run, trailing }) => prefix + run + trailing),
  );
}

/** 開始フェンスの行より後ろの、閉じフェンスかEOFまでの本体。閉じフェンスも含めて返します。 */
function fenceBody(opening: string): TextParser {
  const closing = fenceClosing(opening);
  const terminator = P.either(
    pipe(
      P.lookAhead(closing),
      P.map(() => undefined),
    ),
    () => P.eof<C.Char>(),
  );
  return pipe(
    P.manyTill(lineWithNewline, terminator),
    P.bindTo("lines"),
    P.bind("closing", () => P.either(closing, () => P.succeed(""))),
    P.map(({ lines, closing }) => lines.join("") + closing),
  );
}

/**
 * 行頭から始まるフェンス付きコードブロック。
 * 中身のURLは加工せず、ブロック全体をそのまま通します。
 */
const fencedCodeBlock: TextParser = pipe(
  fencePrefix,
  P.bindTo("prefix"),
  P.bind("opening", () => P.either(fenceRun("`", 3), () => fenceRun("~", 3))),
  P.bind("info", () => restOfLine),
  P.bind("body", ({ opening }) =>
    P.either(
      pipe(
        newline,
        P.chain((nl) =>
          pipe(
            fenceBody(opening),
            P.map((body) => nl + body),
          ),
        ),
      ),
      () => P.succeed(""),
    ),
  ),
  P.map(({ prefix, opening, info, body }) => prefix + opening + info + body),
);

/**
 * 行頭から始まるHTMLブロック。空行かEOFまで続きます。
 * GitHubはHTMLブロック内の裸のURLを自動リンクにしないため、囲まずにそのまま通します。
 * `<https://...>`のような自動リンクをタグと取り違えないよう、タグ名の直後の文字で判定します。
 */
const htmlBlock: TextParser = pipe(
  C.char("<"),
  P.bindTo("open"),
  P.bind("slash", () => P.either(C.char("/"), () => P.succeed(""))),
  P.bind("tagName", () => C.many1(C.alphanum)),
  P.apFirst(
    P.either(
      pipe(
        P.lookAhead(C.oneOf(" />\n")),
        P.map(() => undefined),
      ),
      () => P.eof<C.Char>(),
    ),
  ),
  P.bind("rest", () =>
    P.manyTill(
      P.item<C.Char>(),
      P.either(
        pipe(
          P.lookAhead(S.string("\n\n")),
          P.map(() => undefined),
        ),
        () => P.eof<C.Char>(),
      ),
    ),
  ),
  P.map(({ open, slash, tagName, rest }) => open + slash + tagName + rest.join("")),
);

/** 行頭でだけ始まるブロック構文。該当しなければ空文字列を返して何も消費しません。 */
const lineStartBlock: TextParser = pipe(
  fencedCodeBlock,
  P.alt(() => htmlBlock),
  P.alt(() => P.succeed<C.Char, string>("")),
);

/** 改行と、その直後の行頭から始まるブロック構文。 */
const lineBreak: TextParser = pipe(
  newline,
  P.chain((nl) =>
    pipe(
      lineStartBlock,
      P.map((block) => nl + block),
    ),
  ),
);

/** 行の途中に現れる要素。どの選択肢も必ず1文字以上消費します。 */
const inlineToken: TextParser = pipe(
  codeSpan,
  P.alt(() => angleBracketed),
  P.alt(() => inlineLink),
  P.alt(() => bareUrl),
  P.alt(() => lineBreak),
  P.alt(() => P.item<C.Char>()),
);

const document: TextParser = pipe(
  lineStartBlock,
  P.bindTo("head"),
  P.bind("tokens", () => P.many(inlineToken)),
  P.apFirst(P.eof<C.Char>()),
  P.map(({ head, tokens }) => head + tokens.join("")),
);

/**
 * Markdown本文中の裸のURLを`<URL>`で囲んで返します。
 * コードスパン、フェンス付きコードブロック、HTMLブロック、
 * 既にリンク構文になっている箇所の中のURLは変更しません。
 * 万一パースできなければ入力をそのまま返します。
 */
export function wrapBareUrls(markdown: string): string {
  // サロゲートペアを分断しないよう、コード単位ではなくコードポイント単位で分割します。
  const result = document(stream([...markdown], 0));
  return isRight(result) ? result.right.value : markdown;
}
