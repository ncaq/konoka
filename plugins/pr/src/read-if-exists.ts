import { readFile, readdir } from "node:fs/promises";

/**
 * Read a file as UTF-8, returning undefined if the file does not exist.
 */
export async function readIfExists(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") {
      // if file don't exist, ignore error.
      return undefined;
    }
    throw new Error(`Failed to read file: ${path}`, { cause: err });
  }
}

/**
 * List directory entries, returning undefined if the directory does not exist.
 */
export async function readdirIfExists(path: string): Promise<readonly string[] | undefined> {
  try {
    return await readdir(path);
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") {
      // if dir don't exist, ignore error.
      return undefined;
    }
    throw new Error(`Failed to read directory: ${path}`, { cause: err });
  }
}

/**
 * Find an entry in a directory by case-insensitive name match.
 *
 * GitHubはCONTRIBUTING.mdやpull_request_template.mdなどの特殊ファイルを大文字小文字を区別せずに認識します。
 * コード上の候補を正規の表記1つに絞り、実行時にファイルシステム側のバリエーションを吸収します。
 */
export async function findCaseInsensitive(dir: string, name: string): Promise<string | undefined> {
  const entries = await readdirIfExists(dir);
  if (entries == null) {
    return undefined;
  }
  const lower = name.toLowerCase();
  return entries.toSorted().find((entry) => entry.toLowerCase() === lower);
}
