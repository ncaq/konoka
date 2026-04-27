/**
 * レビュー関係のスキーマと型定義関連をまとめたモジュール。
 * 循環参照を避けるためにスキーマ関連はまとめたほうが良いことが多い。
 */

import { Schema } from "effect";
import { valid as semverValid } from "semver";

/** 入力が空文字や空白のみの場合に`undefined`扱いとして正規化するためのバリデーター。 */
export function pickNonBlank(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * 任意のスキーマを「マッチすればその値、しなければ`"unknown"`」に倒すラッパー。
 * 各バリエーションごとにバリデーションロジックを書き直さず、`Schema.is`で対象スキーマの判定を流用します。
 * 入力には`undefined`、空文字、空白のみも許容し、内部で`pickNonBlank`によって正規化します。
 */
function fallbackToUnknown<A extends string>(
  schema: Schema.Schema<A, string>,
): Schema.Schema<A | "unknown", string | undefined> {
  const isValid = Schema.is(schema);
  return Schema.transform(Schema.UndefinedOr(Schema.String), Schema.Union(schema, UnknownLiteral), {
    strict: true,
    decode: (raw) => {
      const trimmed = pickNonBlank(raw);
      return trimmed != null && isValid(trimmed) ? trimmed : ("unknown" as const);
    },
    encode: (decoded) => (decoded === "unknown" ? undefined : decoded),
  });
}

/** 値が不明だった時はこれで埋めます。 */
export const UnknownLiteral = Schema.Literal("unknown");

/** 空ではない文字列、もしくは`"unknown"`。*/
export const NonEmptyStringOrUnknownSchema = fallbackToUnknown(Schema.NonEmptyString);

/**
 * GitのSHA形式かどうかを判定します。
 * 短縮7桁から完全40桁までの16進文字(大文字小文字どちらも可)を許容します。
 * 正規表現ではなく文字単位の線形走査で行うため、ReDoSの懸念がありません。
 */
function isSha(value: string): boolean {
  if (value.length < 7 || value.length > 40) {
    return false;
  }
  const charCodes = [...value].map((c) => c.charCodeAt(0));
  for (const c of charCodes) {
    const isDigit = c >= 0x30 && c <= 0x39;
    const isUpperHex = c >= 0x41 && c <= 0x46;
    const isLowerHex = c >= 0x61 && c <= 0x66;
    if (!(isDigit || isUpperHex || isLowerHex)) {
      return false;
    }
  }
  return true;
}

/**
 * SemVer形式かどうかを判定します。
 * 自前で正規表現や手書きパーサを書くと量指定子のバックトラック(ReDoS)や仕様の取りこぼしが起きやすいため、
 * Node.js本家でも使われている枯れたライブラリ`semver`に判定を委譲します。
 */
function isSemVer(value: string): boolean {
  return semverValid(value) !== null;
}

/** GitのSHA形式(短縮7桁から完全40桁の16進)。 */
export const ShaSchema = Schema.NonEmptyString.pipe(
  Schema.filter(isSha, { description: "Git SHA (7-40 hex characters)" }),
);

/** SemVerの形式。`1.2.3`を基本とし、プレリリース・ビルドメタデータも許容。 */
export const SemVerSchema = Schema.NonEmptyString.pipe(
  Schema.filter(isSemVer, { description: "SemVer (MAJOR.MINOR.PATCH[-prerelease][+build])" }),
);

/** SemVerの形式、もしくは`"unknown"`。 */
export const SemVerOrUnknownSchema = fallbackToUnknown(SemVerSchema);

/** 実行環境。検出できない場合は`"unknown"`。 */
export const ExecutionSchema = Schema.Literal("GitHub Actions", "Claude Code CLI", "unknown");

/** PR 番号は正の整数。 */
export const PrNumberSchema = Schema.Number.pipe(Schema.int(), Schema.positive());

/** 差分の古い方を指す"LEFT"、新しい方を指す"RIGHT"。 */
export const DiffSideSchema = Schema.Literal("LEFT", "RIGHT");

/**
 * レビューコメントの重要度レベル。
 * GitHub Alertの定義と合わせています。
 * スキーマレベルで順位はつけていいませんが、
 * 重要度は左の方が高いです。
 */
export const ReviewLevelSchema = Schema.Literal("CAUTION", "WARNING", "IMPORTANT", "TIP", "NOTE");

/** サブエージェントと対応するタグ。 */
export const ReviewTagSchema = Schema.Literal(
  "code-quality",
  "dependency",
  "documentation",
  "performance",
  "security",
  "test",
);

/** レビューのインラインコメントの入力スキーマ。 */
export const ReviewCommentSchema = Schema.Struct({
  path: Schema.NonEmptyString,
  body: Schema.NonEmptyString,
  line: Schema.Number.pipe(Schema.int(), Schema.positive()),
  startLine: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.positive()), { exact: true }),
  side: Schema.optionalWith(DiffSideSchema, { exact: true }),
  level: ReviewLevelSchema,
  tags: Schema.Array(ReviewTagSchema),
});

/** トップレベルレビューの種別。 */
export const ReviewEventSchema = Schema.Literal("APPROVE", "COMMENT", "REQUEST_CHANGES");

/**
 * LLM が任意で渡すメタデータ。
 * LLM自身しか確実には知らない情報のみ入力を要求します。
 */
export const ReviewMetadataInputSchema = Schema.Struct({
  model: Schema.optionalWith(Schema.NonEmptyString, { exact: true }),
});

/**
 * レビュー実行中に発生した内部エラーの1件分。
 * `subject`は見出しに、`body`はその直下のMarkdownとしてそのまま展開されます。
 * スタックトレース等の生ログを載せる場合は呼び出し側でコードブロックで囲んでください。
 */
export const InternalErrorSchema = Schema.Struct({
  subject: Schema.NonEmptyString,
  body: Schema.NonEmptyString,
});

/** 内部エラーの配列。空配列も許容します(その場合はセクション自体を出力しません)。 */
export const InternalErrorsSchema = Schema.Array(InternalErrorSchema);

/**
 * レビュー投稿の全体の入力スキーマ。
 */
export const ReviewSubmissionSchema = Schema.Struct({
  owner: Schema.NonEmptyString,
  repo: Schema.NonEmptyString,
  prNumber: PrNumberSchema,
  headCommitId: ShaSchema,
  event: ReviewEventSchema,
  body: Schema.NonEmptyString,
  metadata: Schema.optionalWith(ReviewMetadataInputSchema, { exact: true }),
  internalErrors: Schema.optionalWith(InternalErrorsSchema, { exact: true }),
  comments: Schema.optionalWith(Schema.Array(ReviewCommentSchema), { exact: true }),
});

/** レビュー投稿の結果スキーマ。 */
export const ReviewSubmissionResultSchema = Schema.Struct({
  reviewId: Schema.Number.pipe(Schema.int(), Schema.positive()),
  htmlUrl: Schema.URL,
});

/**
 * フッターレンダリング直前のビュー。
 * `commit`は`unknown`フォールバックを設けません。
 * レビュー対象を後から辿る上で必須の情報なので、欠落は入力スキーマ側で弾きます。
 */
export const FooterViewSchema = Schema.Struct({
  commit: ShaSchema,
  pr: PrNumberSchema,
  kyoseiVersion: SemVerSchema,
  kyoseiActionVersion: SemVerOrUnknownSchema,
  claudeCodeVersion: SemVerOrUnknownSchema,
  model: NonEmptyStringOrUnknownSchema,
  execution: ExecutionSchema,
  runUrl: Schema.optionalWith(Schema.URL, { exact: true }),
});
