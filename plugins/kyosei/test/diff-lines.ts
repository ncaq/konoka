/**
 * テスト用のdiff文字列を行の配列から組み立てます。
 * diffの文脈行は先頭が1つの空白で始まるため、
 * テンプレートリテラルで書くとエディタの設定やインデント検査と相性が悪いのを避けています。
 * 末尾には改行を付けます。
 */
export function diffLines(...rows: readonly string[]): string {
  return `${rows.join("\n")}\n`;
}
