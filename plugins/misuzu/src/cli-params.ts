/**
 * CLIエントリポイントで共有するフラグと引数の定義。
 * `bin/`から切り出すことで、パース挙動をテストから検証できるようにしています。
 */

import { Argument, Flag } from "effect/cli";

/**
 * 投稿を伴わないdry-runモードのフラグ。
 * v4の`Flag.Boolean`は省略すると必須扱いになるため、省略時は投稿する(`false`)ようにします。
 */
export const dryRunFlag = Flag.Boolean("dry-run").pipe(
  Flag.withDescription(
    "投稿せずに、スキーマ検証済みの投稿予定データをJSON出力します。GitHub APIへのアクセスは行われません。",
  ),
  Flag.withDefault(false),
);

/** 対象PRまたはレビューのURL。省略可能で、省略時は`Option.none`になります。 */
export const prUrlArgument = Argument.String("pr-url").pipe(
  Argument.withDescription(
    "対象PRまたはレビューのURL。省略時はカレントブランチからPRを推定し、" +
      "PRが見つからなければローカルコンテキストになります。",
  ),
  Argument.optional,
);
