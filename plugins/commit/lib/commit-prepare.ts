/** Thrown when there is nothing to commit. */
export class EmptyCommitError extends Error {
  override name = "EmptyCommitError" as const;
  constructor(message: string) {
    super(message);
  }
}

/** Generate an ISO 8601-like timestamp for use in directory names. */
export function timestamp(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  return `${date}T${time}`;
}

/** Check whether git status --porcelain output contains staged entries. */
export function hasStagedChanges(status: string): boolean {
  return status.split("\n").some((line) => {
    const index = line[0];
    return index != null && index !== " " && index !== "?";
  });
}

/** Build a COMMIT_EDITMSG template string with scissors line and diff. */
export function buildEditmsgTemplate(diff: string): string {
  return `\n# ------------------------ >8 ------------------------\n${diff}\n`;
}
