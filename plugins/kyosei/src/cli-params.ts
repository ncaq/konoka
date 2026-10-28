/**
 * CLIエントリポイントで共有するフラグと引数の定義。
 * `bin/`から切り出すことで、パース挙動をテストから検証できるようにしています。
 */

import { Argument, Flag } from "effect/cli";

/**
 * 投稿を伴わないdry-runモードのフラグ。
 * v4の`Flag.Boolean`は省略すると必須扱いになるため、省略時は`false`にします。
 */
export const dryRunFlag = Flag.Boolean("dry-run").pipe(
  Flag.withDescription(
    "投稿せずに、組み立て済みのcreateReviewパラメータをJSON出力します。スキーマ検証とメタデータフッター生成は実行されます。",
  ),
  Flag.withDefault(false),
);

/** 対象PRのURL。省略可能で、省略時は`Option.none`になります。 */
export const prUrlArgument = Argument.String("pr-url").pipe(
  Argument.withDescription(
    "対象PRのURL。省略時はカレントブランチからローカルコンテキストを推定します。",
  ),
  Argument.optional,
);
