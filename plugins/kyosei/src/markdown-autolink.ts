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
 * コードスパン、フェンス付きコードブロック、HTMLブロックとインラインHTML、
 * 既にリンク構文になっている箇所の中のURLは変更しません。
 *
 * 本文はLLMの出力で、PRの内容によるプロンプトインジェクションの影響も受けるため、
 * 入力の長さを制御できません。
 * 同じ記号や英字が数万個続くような入力でも本文の長さに比例した時間で終わるよう、
 * 繰り返しは結果を複製しない結合子で組み立てています。
 */

import { tailRec } from "fp-ts/ChainRec";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as P from "parser-ts/Parser";
import { stream } from "parser-ts/Stream";
import * as C from "parser-ts/char";
import * as S from "parser-ts/string";

type TextParser = P.Parser<C.Char, string>;

// 繰り返しの結合子。

/**
 * `parser`が失敗するまで繰り返し、結果の文字列を連結します。
 * ライブラリの`many`は1回ごとに結果の配列を複製するため、繰り返しの回数の二乗の時間がかかります。
 * 代わりに`chainRec`で文字列を連結しながら読み進め、回数に比例した時間で終わらせます。
 * `parser`が1文字も消費せずに成功すると止まらないため、必ず消費するものに限ります。
 */
function manyString(parser: TextParser): TextParser {
  return P.ChainRec.chainRec("", (accumulated) =>
    pipe(
      parser,
      P.map((value): E.Either<string, string> => E.left(accumulated + value)),
      P.alt(() => P.succeed<C.Char, E.Either<string, string>>(E.right(accumulated))),
    ),
  );
}

/** `manyString`と同じですが、`parser`が1回も成功しなければ失敗します。 */
function many1String(parser: TextParser): TextParser {
  return pipe(
    parser,
    P.chain((head) =>
      pipe(
        manyString(parser),
        P.map((rest) => head + rest),
      ),
    ),
  );
}

/**
 * `terminator`が成功するまで`parser`を繰り返し、結果の文字列を連結します。
 * ライブラリの`manyTill`と同じく`terminator`は消費し、その結果は捨てます。
 * `terminator`より先に`parser`が失敗すれば全体も失敗します。
 */
function manyStringTill(parser: TextParser, terminator: P.Parser<C.Char, unknown>): TextParser {
  return P.ChainRec.chainRec("", (accumulated) =>
    pipe(
      terminator,
      P.map((): E.Either<string, string> => E.right(accumulated)),
      P.alt(() =>
        pipe(
          parser,
          P.map((value): E.Either<string, string> => E.left(accumulated + value)),
        ),
      ),
    ),
  );
}

// 行の基本パーサ。

const newline = C.char("\n");

/** 改行直前までの文字列(改行は含まない)。 */
const restOfLine: TextParser = manyString(C.notChar("\n"));

/** `parser`が続くかEOF。入力は消費せず、境界の判定にだけ使います。 */
function lookAheadOrEof<A>(parser: P.Parser<C.Char, A>): P.Parser<C.Char, void> {
  return P.either(
    pipe(
      P.lookAhead(parser),
      P.map(() => undefined),
    ),
    () => P.eof<C.Char>(),
  );
}

/** 改行かEOF。入力は消費せず、行末の判定にだけ使います。 */
const lineEnd: P.Parser<C.Char, void> = lookAheadOrEof(newline);

/**
 * 行末から始まる空行。改行の後に空白とタブだけが続き、改行かEOFで終わるもの。
 * CommonMarkでは空白とタブだけの行も空行なので、`\n\n`に限定しません。
 */
const blankLine: TextParser = pipe(
  newline,
  P.bindTo("newline"),
  P.bind("spaces", () => manyString(C.oneOf(" \t"))),
  P.apFirst(lineEnd),
  P.map(({ newline, spaces }) => newline + spaces),
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

// 裸のURL。

/**
 * 裸のURLとして扱う文字。
 * GFMは空白まで進みますが、URLはASCIIで構成されるため非ASCII文字で打ち切ります。
 * 以下の3文字はそれぞれの理由で除外します。
 *
 * - `<`: GFMと同じく裸のURLの終端とする
 * - `>`: 囲んだ後の`<URL>`を壊す
 * - バッククォート: コードスパンの開始として扱う
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

function isAsciiLetter(c: string): boolean {
  const code = c.codePointAt(0);
  return code !== undefined && ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a));
}

/**
 * `url`の`semicolonIndex`にある`;`が`&amp;`のような文字実体参照の末尾なら、その`&`の位置を返します。
 * 文字実体参照の形でなければ`-1`を返します。
 * GitHubは`&`の後に英字だけが続く時しか文字実体参照とみなさず、
 * `&a1;`のように数字を含む名前は`;`だけを取り除くため、名前の文字は英字に限ります。
 * `;`が多数続く入力でも毎回先頭まで走査しないよう、`;`の手前の英字の並びだけを戻ります。
 */
function entityStartIndex(url: string, semicolonIndex: number): number {
  const ampersandIndex = tailRec(semicolonIndex - 1, (index) =>
    index >= 0 && isAsciiLetter(url.charAt(index)) ? E.left(index - 1) : E.right(index),
  );
  const hasName = ampersandIndex < semicolonIndex - 1;
  return hasName && url.charAt(ampersandIndex) === "&" ? ampersandIndex : -1;
}

/** `trimAutolinkTail`が末尾を縮めている間の状態。 */
interface TrimState {
  /** 残すと決めた範囲の終端。 */
  readonly end: number;
  /** `end`より手前にある閉じ括弧の数。 */
  readonly closing: number;
}

/**
 * GFMの自動リンクがリンクに含めない末尾の文字を取り除きます。
 *
 * - `?!.,:*_~'"`は末尾から繰り返し取り除く
 * - `)`は開き括弧より閉じ括弧が多い時だけ取り除く(`https://example.com/Foo_(bar)`は保つ)
 * - `;`は`&amp;`のような文字実体参照の形(`&`と英字の並び)ならその全体を、そうでなければ`;`だけを取り除く
 *
 * 記号1文字ごとに関数を再帰させると、記号が数万個続く入力でコールスタックの上限を超えて例外になります。
 * スタックを消費しない`tailRec`で末尾の位置を進め、括弧の数も取り除くたびに減らして数え直しを避けます。
 */
function trimAutolinkTail(url: string): string {
  const opening = countChar(url, "(");
  const initial: TrimState = { end: url.length, closing: countChar(url, ")") };
  const end = tailRec(initial, ({ end, closing }): E.Either<TrimState, number> => {
    // 先頭まで取り除いた時は`charAt(-1)`が空文字列になり、どの条件にも当たらず終わります。
    const last = url.charAt(end - 1);
    if (trailingPunctuation.has(last)) {
      return E.left({ end: end - 1, closing });
    }
    if (last === ")" && closing > opening) {
      return E.left({ end: end - 1, closing: closing - 1 });
    }
    if (last === ";") {
      const ampersandIndex = entityStartIndex(url, end - 1);
      return E.left({ end: ampersandIndex === -1 ? end - 1 : ampersandIndex, closing });
    }
    return E.right(end);
  });
  return url.slice(0, end);
}

/** GitHubと同じく大文字小文字は区別しません。 */
function isAutolinkScheme(scheme: string): boolean {
  return ["http", "https"].includes(scheme.toLowerCase());
}

/**
 * `scheme://body`の形の裸のURLを`<URL>`で囲みます。
 * リンクに含めない末尾の記号は`>`の外側へ出します。
 *
 * 以下はGitHubも自動リンクにしないので、囲まずにそのまま返します。
 *
 * - `http`と`https`以外のスキーム
 * - `foohttps://example.com`のように英字の直後に続くスキーム(英字の並び全体がスキームになる)
 * - スキームだけでホストが無いもの
 */
function wrapUrl(scheme: string, body: string): string {
  const raw = `${scheme}://${body}`;
  if (!isAutolinkScheme(scheme)) {
    return raw;
  }
  const url = trimAutolinkTail(raw);
  return url.length > `${scheme}://`.length ? `<${url}>${raw.slice(url.length)}` : raw;
}

/**
 * 英字の並びと、それに`://`が続く場合はその後ろの裸のURL本体。
 * `://`が続けば英字の並びをスキームとしてURLを囲み、続かなければ英字の並びをそのまま通します。
 *
 * 英字の並びを1つの要素として消費するのは、裸のURLは英字の並びの途中からは始まらないためです。
 * 英字を1文字ずつ通すと、位置ごとに残りの英字を読み直してから`://`の有無を調べることになり、
 * 英字が長く続く入力で長さの三乗の時間がかかります。
 */
const wordOrBareUrl: TextParser = pipe(
  many1String(C.letter),
  P.chain((letters) =>
    P.either(
      pipe(
        S.string("://"),
        P.apSecond(manyString(P.sat(isUrlBodyChar))),
        P.map((body) => wrapUrl(letters, body)),
      ),
      () => P.succeed(letters),
    ),
  ),
);

// 行内の構文。

/**
 * コードスパン。開いたバッククォートと同じ長さの閉じを探します。
 * 閉じが見つからなければ失敗させ、先頭のバッククォートを普通の文字として扱わせます。
 */
const codeSpan: TextParser = pipe(
  many1String(C.char("`")),
  P.chain((opening) =>
    pipe(
      manyStringTill(P.item<C.Char>(), S.string(opening)),
      P.map((content) => opening + content + opening),
    ),
  ),
);

/**
 * `<...>`で囲まれた1行内の範囲。
 * 既に`<URL>`になっている自動リンクと、`<a href="...">`のようなインラインHTMLをそのまま通します。
 * `a < b`のような比較演算子を取り違えないよう、`<`の直後が英字か`/`で始まるものに限ります。
 * 自動リンクのスキームもタグ名も英字で始まり、閉じタグは`/`で始まるためこの条件で足ります。
 */
const angleBracketed: TextParser = pipe(
  C.char("<"),
  P.apSecond(P.either(C.letter, () => C.char("/"))),
  P.bindTo("head"),
  P.bind("rest", () => manyString(C.notOneOf("<>\n"))),
  P.apFirst(C.char(">")),
  P.map(({ head, rest }) => `<${head}${rest}>`),
);

/**
 * `[text](destination)`形式のインラインリンク。
 * リンクの中にリンクは置けないため、テキストもリンク先もそのまま通します。
 * `[!NOTE]`のようにリンクではない角括弧を誤って飲み込まないよう、テキストに角括弧と改行は含めません。
 */
const inlineLink: TextParser = pipe(
  C.char("["),
  P.apSecond(manyString(C.notOneOf("[]\n"))),
  P.bindTo("text"),
  P.apFirst(S.string("](")),
  P.bind("destination", () => manyString(C.notOneOf(")\n"))),
  P.apFirst(C.char(")")),
  P.map(({ text, destination }) => `[${text}](${destination})`),
);

// 行頭から始まるブロック構文。

/**
 * フェンスの前に置ける、空白のインデントと引用記号`>`の並び。
 * CommonMarkではインデントは3個までですが、
 * リスト項目や引用の中のフェンスはその分だけ深くインデントされるため、
 * 入れ子の深さを追わずに任意の並びを許します。
 */
const fencePrefix: TextParser = manyString(C.oneOf(" >"));

/** 同じフェンス文字を`minLength`個以上並べたもの。 */
function fenceRun(fenceChar: string, minLength: number): TextParser {
  return satisfying(many1String(C.char(fenceChar)), (run) => run.length >= minLength);
}

/** 開始フェンスに対応する閉じフェンスの行。末尾の改行は消費しません。 */
function fenceClosing(opening: string): TextParser {
  return pipe(
    fencePrefix,
    P.bindTo("prefix"),
    P.bind("run", () => fenceRun(opening.charAt(0), opening.length)),
    P.bind("trailing", () => manyString(C.char(" "))),
    P.apFirst(lineEnd),
    P.map(({ prefix, run, trailing }) => prefix + run + trailing),
  );
}

/** 開始フェンスの行より後ろの、閉じフェンスかEOFまでの本体。閉じフェンスも含めて返します。 */
function fenceBody(opening: string): TextParser {
  const closing = fenceClosing(opening);
  return pipe(
    manyStringTill(lineWithNewline, lookAheadOrEof(closing)),
    P.bindTo("lines"),
    P.bind("closing", () => P.either(closing, () => P.succeed(""))),
    P.map(({ lines, closing }) => lines + closing),
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
  // バッククォートのフェンスの情報文字列にはバッククォートを含められません。
  // 含む行はフェンスではなくコードスパンなので、ここで失敗させて`codeSpan`に任せます。
  P.bind("info", ({ opening }) =>
    opening.startsWith("`") ? satisfying(restOfLine, (info) => !info.includes("`")) : restOfLine,
  ),
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
 * 行頭に現れるとHTMLブロックを始めるタグ名。
 * CommonMarkのHTMLブロック(type 6)の一覧で、大文字小文字は区別しません。
 * `<kbd>`や`<b>`のような一般のタグは、タグだけで終わる行でないとブロックにならず、
 * 段落を途中で打ち切ることもできないため含めません。
 */
const htmlBlockTagNames: ReadonlySet<string> = new Set([
  "address",
  "article",
  "aside",
  "base",
  "basefont",
  "blockquote",
  "body",
  "caption",
  "center",
  "col",
  "colgroup",
  "dd",
  "details",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "frame",
  "frameset",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "iframe",
  "legend",
  "li",
  "link",
  "main",
  "menu",
  "menuitem",
  "nav",
  "noframes",
  "ol",
  "optgroup",
  "option",
  "p",
  "param",
  "search",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "track",
  "ul",
]);

/**
 * 行頭から始まるHTMLブロック。空行かEOFまで続きます。
 * GitHubはHTMLブロック内の裸のURLを自動リンクにしないため、囲まずにそのまま通します。
 * `<https://...>`のような自動リンクをタグと取り違えないよう、タグ名の直後の文字で判定します。
 * インラインタグで始まる普通の段落を飲み込まないよう、タグ名はブロックを始めるものに限定します。
 */
const htmlBlock: TextParser = pipe(
  C.char("<"),
  P.bindTo("open"),
  P.bind("slash", () => P.either(C.char("/"), () => P.succeed(""))),
  P.bind("tagName", () =>
    satisfying(many1String(C.alphanum), (tagName) => htmlBlockTagNames.has(tagName.toLowerCase())),
  ),
  P.apFirst(lookAheadOrEof(C.oneOf(" />\n"))),
  P.bind("rest", () => manyStringTill(P.item<C.Char>(), lookAheadOrEof(blankLine))),
  P.map(({ open, slash, tagName, rest }) => open + slash + tagName + rest),
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

// 文書全体。

/**
 * 行内のどの構文も始められない文字の並び。空白や記号、日本語などの非ASCII文字です。
 * 1文字ずつ全ての構文を試してから通すより、まとめて通したほうが本文の大半を速く読み進められます。
 */
const plainRun: TextParser = many1String(
  satisfying(C.notLetter, (c) => !["`", "<", "[", "\n"].includes(c)),
);

/** 行の途中に現れる要素。どの選択肢も必ず1文字以上消費します。 */
const inlineToken: TextParser = pipe(
  codeSpan,
  P.alt(() => angleBracketed),
  P.alt(() => inlineLink),
  P.alt(() => wordOrBareUrl),
  P.alt(() => lineBreak),
  P.alt(() => plainRun),
  P.alt(() => P.item<C.Char>()),
);

const document: TextParser = pipe(
  lineStartBlock,
  P.bindTo("head"),
  P.bind("tokens", () => manyString(inlineToken)),
  P.apFirst(P.eof<C.Char>()),
  P.map(({ head, tokens }) => head + tokens),
);

/**
 * Markdown本文中の裸のURLを`<URL>`で囲んで返します。
 * コードスパン、フェンス付きコードブロック、HTMLブロックとインラインHTML、
 * 既にリンク構文になっている箇所の中のURLは変更しません。
 * 万一パースできなかったり例外が投げられたりした場合は入力をそのまま返します。
 * 整形は補助的な処理なので、細工された本文でレビューの投稿全体を失敗させないためです。
 */
export function wrapBareUrls(markdown: string): string {
  try {
    // サロゲートペアを分断しないよう、コード単位ではなくコードポイント単位で分割します。
    const result = document(stream([...markdown], 0));
    return E.isRight(result) ? result.right.value : markdown;
  } catch (error) {
    // 投稿は止めませんが、黙って囲まない結果になると気付けないので、
    // 原因を追えるよう標準エラー出力に残します。
    console.error(
      `wrapBareUrls: fallback to the input (${markdown.length} chars): ${String(error)}`,
    );
    return markdown;
  }
}
