import { join } from "node:path";
import { findCaseInsensitive, readIfExists } from "./read-if-exists.ts";

/**
 * Search locations for the contributing guideline file.
 *
 * Ordered by GitHub's display priority. The first match wins.
 */
const CONTRIBUTING_LOCATIONS = [".", ".github", "docs"] as const;

/**
 * Canonical file name. Case-insensitive variants are absorbed at runtime.
 */
const CONTRIBUTING_NAME = "CONTRIBUTING.md" as const;

export interface ContributingFile {
  readonly path: string;
  readonly content: string;
}

async function readAtLocation(root: string, location: string): Promise<ContributingFile | undefined> {
  const dir = join(root, location);
  const found = await findCaseInsensitive(dir, CONTRIBUTING_NAME);
  if (found == null) {
    return undefined;
  }
  const path = location === "." ? found : join(location, found);
  const content = await readIfExists(join(root, path));
  if (content == null) {
    return undefined;
  }
  return { path, content };
}

/**
 * Read the repository's contributing guideline file if it exists.
 *
 * @param root Repository root to search from. Defaults to the current working directory.
 */
export async function readContributing(root = "."): Promise<ContributingFile | undefined> {
  const candidates = await Promise.all(CONTRIBUTING_LOCATIONS.map((location) => readAtLocation(root, location)));
  return candidates.find((candidate) => candidate != null);
}

/**
 * Format a contributing file as a markdown section.
 */
export function formatContributing(file: ContributingFile): string {
  return `# ${file.path}\n\n${file.content}`;
}
