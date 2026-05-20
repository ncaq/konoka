import { FileSystem } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import { Effect, Option } from "effect";

const commitInstructionsPath = ".github/git-commit-instructions.md" as const;

/**
 * プロジェクト固有のコミットメッセージガイドラインを読み込みます。
 *
 * UTF-8として読み取った内容を`Option.some`で返します。
 * ファイルが存在しない場合は`Option.none`を返します。
 */
export const readCommitInstructions: Effect.Effect<
  Option.Option<string>,
  PlatformError,
  FileSystem.FileSystem
> = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(commitInstructionsPath, "utf8").pipe(
    Effect.map(Option.some),
    Effect.catchTag("SystemError", (err) =>
      err.reason === "NotFound" ? Effect.succeed(Option.none<string>()) : Effect.fail(err),
    ),
  );
});
