/**
 * レビューのインラインコメントが指す行番号を、投稿前に差分と照合するモジュール。
 *
 * GitHubのレビューコメントは、差分のhunkに含まれる行にしか付けられません。
 * `line`と`startLine`は`side`が`RIGHT`なら新ファイル、`LEFT`なら旧ファイルの行番号で、
 * どちらもhunkヘッダの範囲内である必要があります。
 * API側で拒否されると(422 `Line could not be resolved`)レビュー全体が投稿されないため、
 * ここで全コメントを検証し、不正なものを全件まとめて報告します。
 */

import { posix } from "node:path";
import { Array as Arr, Data, Effect, Option } from "effect";
import type { DiffSideSchema, ReviewCommentSchema } from "./review-schema";
import type { DiffFile, DiffHunk } from "./unified-diff";

type DiffSide = typeof DiffSideSchema.Type;
type ReviewComment = typeof ReviewCommentSchema.Type;

/** hunk1つ分の、sideごとのコメント可能な行範囲(両端を含む)。 */
export interface CommentableRange {
  readonly header: string;
  readonly start: number;
  readonly end: number;
}

/** 1件のコメントが不正である理由。 */
export type CommentLineProblemReason =
  | { readonly _tag: "PathNotInDiff"; readonly similarPaths: readonly string[] }
  | { readonly _tag: "PathRenamed"; readonly renamedTo: string }
  | { readonly _tag: "BinaryFile" }
  | { readonly _tag: "NoCommentableLines" }
  | { readonly _tag: "LineOutsideHunk" }
  | { readonly _tag: "StartLineNotBeforeLine" }
  | { readonly _tag: "StartLineOutsideHunk" }
  | { readonly _tag: "RangeSpansHunks"; readonly startHeader: string; readonly endHeader: string };

/** 不正だったコメント1件の情報。 */
export interface CommentLineProblem {
  /** `comments`配列内の位置。 */
  readonly index: number;
  readonly comment: ReviewComment;
  /** 省略時は`RIGHT`に正規化済み。 */
  readonly side: DiffSide;
  readonly reason: CommentLineProblemReason;
  /** そのファイル・sideでコメント可能な範囲一覧。パスが見つからない場合は空。 */
  readonly commentableRanges: readonly CommentableRange[];
}

function describeReason(reason: CommentLineProblemReason, side: DiffSide): string {
  switch (reason._tag) {
    case "PathNotInDiff": {
      return "path is not present in the patch";
    }
    case "PathRenamed": {
      return `path was renamed in this patch; use the new path "${reason.renamedTo}"`;
    }
    case "BinaryFile": {
      return "binary files cannot receive inline comments";
    }
    case "NoCommentableLines": {
      return `this file has no hunk lines on side ${side} (rename or mode change only)`;
    }
    case "LineOutsideHunk": {
      return `line is not inside any hunk of this file on side ${side}`;
    }
    case "StartLineNotBeforeLine": {
      return "startLine must be smaller than line";
    }
    case "StartLineOutsideHunk": {
      return `startLine is not inside any hunk of this file on side ${side}`;
    }
    case "RangeSpansHunks": {
      return (
        `startLine (${reason.startHeader}) and line (${reason.endHeader}) ` +
        "are in different hunks"
      );
    }
  }
}

function formatProblem(problem: CommentLineProblem): string {
  const { comment, side } = problem;
  const position =
    comment.startLine == null
      ? `line=${comment.line}`
      : `startLine=${comment.startLine} line=${comment.line}`;
  const lines = [
    `comments[${problem.index}]: path="${comment.path}" side=${side} ${position}`,
    `  reason: ${describeReason(problem.reason, side)}`,
  ];
  if (problem.reason._tag === "PathNotInDiff" && problem.reason.similarPaths.length > 0) {
    lines.push(`  did you mean: ${problem.reason.similarPaths.join(", ")}`);
  }
  if (problem.commentableRanges.length > 0) {
    lines.push(`  commentable lines (${side}) in ${comment.path}:`);
    for (const range of problem.commentableRanges) {
      lines.push(`    ${range.start}-${range.end}  ${range.header}`);
    }
  }
  return lines.join("\n");
}

const howToFix = `how to fix:
  \`line\`と\`startLine\`には、パッチファイル(changeset.patch)内の行番号ではなく、
  対象ファイル自体の行番号を指定してください。
  changeset.patchではhunk内の各行の先頭にその番号が付いています。
  削除行(-)に付いている番号は旧ファイルの行番号なので、その行への指摘には\`"side": "LEFT"\`が必要です。
  追加行(+)と文脈行に付いている番号は新ファイルの行番号で、\`side\`は省略(RIGHT)できます。
  複数行コメントはstartLine < lineで、両方が同じhunkに含まれている必要があります。
  上の範囲内に収められない指摘はcommentsから外し、レビュー本文(body)に書いてください。`;

/** インラインコメントの行番号が差分と照合できなかった場合の失敗。 */
export class InvalidReviewCommentLines extends Data.TaggedError("InvalidReviewCommentLines")<{
  readonly problems: readonly CommentLineProblem[];
  readonly totalComments: number;
}> {
  override get message(): string {
    const summary =
      `invalid inline comment lines: ${this.problems.length} of ${this.totalComments} ` +
      "comments cannot be resolved against the patch";
    return [summary, ...this.problems.map(formatProblem), howToFix].join("\n\n");
  }
}

/** hunkヘッダから、sideごとのコメント可能な行範囲を求めます。 */
function hunkRanges(hunk: DiffHunk, side: DiffSide): readonly CommentableRange[] {
  const start = side === "RIGHT" ? hunk.newStart : hunk.oldStart;
  const count = side === "RIGHT" ? hunk.newLines : hunk.oldLines;
  return count > 0 ? [{ header: hunk.header, start, end: start + count - 1 }] : [];
}

/** ファイル1つ分のコメント可能な行。 */
interface CommentableFile {
  readonly file: DiffFile;
  readonly ranges: Readonly<Record<DiffSide, readonly CommentableRange[]>>;
}

/** パスをキーにしたコメント可能行の索引を作ります。 */
function buildCommentableIndex(files: readonly DiffFile[]): ReadonlyMap<string, CommentableFile> {
  return new Map(
    files.map((file) => {
      const hunks = file.content.kind === "text" ? file.content.hunks : [];
      return [
        file.path,
        {
          file,
          ranges: {
            LEFT: hunks.flatMap((hunk) => hunkRanges(hunk, "LEFT")),
            RIGHT: hunks.flatMap((hunk) => hunkRanges(hunk, "RIGHT")),
          },
        },
      ];
    }),
  );
}

/** リネームされたファイルの旧パスから新パスへの対応。 */
function buildRenameIndex(files: readonly DiffFile[]): ReadonlyMap<string, string> {
  return new Map(
    Arr.getSomes(
      files.map((file) =>
        file.kind === "renamed" ? Option.some([file.oldPath, file.path] as const) : Option.none(),
      ),
    ),
  );
}

function findRange(
  ranges: readonly CommentableRange[],
  line: number,
): Option.Option<CommentableRange> {
  return Arr.findFirst(ranges, (range) => range.start <= line && line <= range.end);
}

/** 1件のコメントが不正なら理由を返します。 */
function diagnoseComment(
  comment: ReviewComment,
  side: DiffSide,
  commentable: ReadonlyMap<string, CommentableFile>,
  renames: ReadonlyMap<string, string>,
): Option.Option<{
  readonly reason: CommentLineProblemReason;
  readonly ranges: readonly CommentableRange[];
}> {
  const found = commentable.get(comment.path);
  if (found == null) {
    const renamedTo = renames.get(comment.path);
    if (renamedTo != null) {
      return Option.some({ reason: { _tag: "PathRenamed", renamedTo }, ranges: [] });
    }
    const basename = posix.basename(comment.path);
    const similarPaths = [...commentable.keys()].filter(
      (path) => posix.basename(path) === basename,
    );
    return Option.some({ reason: { _tag: "PathNotInDiff", similarPaths }, ranges: [] });
  }
  const ranges = found.ranges[side];
  if (found.file.content.kind === "binary") {
    return Option.some({ reason: { _tag: "BinaryFile" }, ranges });
  }
  if (ranges.length === 0) {
    return Option.some({ reason: { _tag: "NoCommentableLines" }, ranges });
  }
  const endRange = findRange(ranges, comment.line);
  if (Option.isNone(endRange)) {
    return Option.some({ reason: { _tag: "LineOutsideHunk" }, ranges });
  }
  if (comment.startLine == null) {
    return Option.none();
  }
  if (comment.startLine >= comment.line) {
    return Option.some({ reason: { _tag: "StartLineNotBeforeLine" }, ranges });
  }
  const startRange = findRange(ranges, comment.startLine);
  if (Option.isNone(startRange)) {
    return Option.some({ reason: { _tag: "StartLineOutsideHunk" }, ranges });
  }
  if (startRange.value !== endRange.value) {
    return Option.some({
      reason: {
        _tag: "RangeSpansHunks",
        startHeader: startRange.value.header,
        endHeader: endRange.value.header,
      },
      ranges,
    });
  }
  return Option.none();
}

/**
 * 全インラインコメントの`path`/`line`/`startLine`/`side`が差分のhunkに含まれるかを検証します。
 * 不正なコメントが1件でもあれば、全件をまとめた`InvalidReviewCommentLines`で失敗します。
 */
export function validateCommentLines(
  files: readonly DiffFile[],
  comments: readonly ReviewComment[],
): Effect.Effect<void, InvalidReviewCommentLines> {
  if (comments.length === 0) {
    return Effect.void;
  }
  const commentable = buildCommentableIndex(files);
  const renames = buildRenameIndex(files);
  const problems = Arr.getSomes(
    comments.map((comment, index) => {
      const side = comment.side ?? "RIGHT";
      return Option.map(
        diagnoseComment(comment, side, commentable, renames),
        (diagnosis): CommentLineProblem => ({
          index,
          comment,
          side,
          reason: diagnosis.reason,
          commentableRanges: diagnosis.ranges,
        }),
      );
    }),
  );
  return problems.length === 0
    ? Effect.void
    : Effect.fail(new InvalidReviewCommentLines({ problems, totalComments: comments.length }));
}
