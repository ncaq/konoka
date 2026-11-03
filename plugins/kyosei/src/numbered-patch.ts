/**
 * unified diffのhunk内の各行に、ファイルの行番号を前置するモジュール。
 *
 * レビュワーは`Read`ツールでパッチを読むため、
 * ツールが左端に表示する「パッチファイル内の行番号」をそのままレビューコメントの`line`に入れてしまい、
 * GitHub APIに拒否される事故が起きていました。
 * 各行の先頭にファイル自体の行番号を置くことで、
 * レビュワーが読み取るべき値を差分の中に直接示します。
 *
 * 削除行(`-`)には旧ファイルの行番号、追加行(`+`)と文脈行には新ファイルの行番号を付けます。
 * ファイルヘッダ、hunkヘッダ、`\ No newline at end of file`、バイナリ表記は加工しません。
 */

import { type DiffDocument, type HunkBodyLine, parseDiffDocument } from "./unified-diff";

/** 行番号の最小の桁数。短いdiffでも列が揃うようにします。 */
const minimumWidth = 4;

/** diff全体で出現しうる最大の行番号から桁数を求めます。 */
function lineNumberWidth(document: DiffDocument): number {
  const maxLine = document.files
    .flatMap((file) => file.hunks)
    .reduce(
      (max, { oldStart, oldLines, newStart, newLines }) =>
        Math.max(max, oldStart + oldLines - 1, newStart + newLines - 1),
      0,
    );
  return Math.max(minimumWidth, String(maxLine).length);
}

/** 本文1行を描画します。削除行は旧ファイル、それ以外は新ファイルの行番号を前置します。 */
function renderLine(line: HunkBodyLine, width: number): string {
  switch (line.kind) {
    case "noNewline": {
      return line.raw;
    }
    case "delete": {
      return `${String(line.oldLine).padStart(width)} ${line.raw}`;
    }
    case "add":
    case "context": {
      return `${String(line.newLine).padStart(width)} ${line.raw}`;
    }
  }
}

/** hunk内の各行の先頭にファイルの行番号を前置した文字列を返します。 */
export function numberDiff(diff: string): string {
  const document = parseDiffDocument(diff, "raw");
  const width = lineNumberWidth(document);
  const lines = document.files.flatMap((file) => [
    ...file.headers.map((header) => header.raw),
    ...file.hunks.flatMap((hunk) => [
      hunk.header,
      ...hunk.lines.map((line) => renderLine(line, width)),
    ]),
  ]);
  const body = lines.join("\n");
  return document.trailingNewline ? `${body}\n` : body;
}
