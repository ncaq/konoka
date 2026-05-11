import { join } from "node:path";
import { findCaseInsensitive, readIfExists, readdirIfExists } from "./read-if-exists.ts";

/**
 * Search locations for pull request templates.
 *
 * Ordered by GitHub's display priority. All matches are returned.
 */
const TEMPLATE_LOCATIONS = [".github", "docs", "."] as const;

/**
 * Canonical single-file template name. Case-insensitive variants are absorbed at runtime.
 */
const TEMPLATE_FILE_NAME = "pull_request_template.md" as const;

/**
 * Canonical multi-template directory name. Case-insensitive variants are absorbed at runtime.
 */
const TEMPLATE_DIR_NAME = "PULL_REQUEST_TEMPLATE" as const;

export interface PullRequestTemplate {
  readonly path: string;
  readonly content: string;
}

function locationPath(location: string, name: string): string {
  return location === "." ? name : join(location, name);
}

async function readSingleAtLocation(
  root: string,
  location: string,
): Promise<PullRequestTemplate | undefined> {
  const dir = join(root, location);
  const found = await findCaseInsensitive(dir, TEMPLATE_FILE_NAME);
  if (found == null) {
    return undefined;
  }
  const path = locationPath(location, found);
  const content = await readIfExists(join(root, path));
  if (content == null) {
    return undefined;
  }
  return { path, content };
}

async function readMultiAtLocation(
  root: string,
  location: string,
): Promise<readonly PullRequestTemplate[]> {
  const dir = join(root, location);
  const found = await findCaseInsensitive(dir, TEMPLATE_DIR_NAME);
  if (found == null) {
    return [];
  }
  const templateDir = locationPath(location, found);
  const entries = await readdirIfExists(join(root, templateDir));
  if (entries == null) {
    return [];
  }
  const candidates = (
    await Promise.all(
      entries
        .filter((entry) => entry.toLowerCase().endsWith(".md"))
        .map(async (entry) => {
          const path = join(templateDir, entry);
          const content = await readIfExists(join(root, path));
          if (content == null) {
            return undefined;
          }
          return { path, content };
        }),
    )
  ).filter((template) => template != null);
  return candidates;
}

/**
 * Read all pull request templates available in the repository.
 *
 * Both single-file templates and multi-template directories are inspected.
 *
 * @param root Repository root to search from. Defaults to the current working directory.
 */
export async function readPullRequestTemplates(
  root = ".",
): Promise<readonly PullRequestTemplate[]> {
  const [singleResults, multiResults] = await Promise.all([
    Promise.all(TEMPLATE_LOCATIONS.map((location) => readSingleAtLocation(root, location))),
    Promise.all(TEMPLATE_LOCATIONS.map((location) => readMultiAtLocation(root, location))),
  ]);
  return [...singleResults.filter((template) => template != null), ...multiResults.flat()];
}

/**
 * Format pull request templates as a single markdown document.
 *
 * Each template is rendered as a section separated by horizontal rules.
 */
export function formatPullRequestTemplates(templates: readonly PullRequestTemplate[]): string {
  return templates.map(({ path, content }) => `# ${path}\n\n${content}`).join("\n\n---\n\n");
}
