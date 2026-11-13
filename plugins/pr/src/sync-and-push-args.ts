import { Data, Effect, Option } from "effect";

/** スキルの確認モードとして消費されるトークン。 */
const confirmationModes: readonly string[] = ["manual", "auto"] as const;

export interface SyncAndPushArgs {
  /** 明示されたbaseブランチ。省略時はリポジトリのデフォルトブランチを使います。 */
  readonly base: Option.Option<string>;
}

/** baseブランチの候補が複数あり、どれをbaseにするか決められないことを表します。 */
export class InvalidArgumentsError extends Data.TaggedError("InvalidArgumentsError")<{
  readonly candidates: readonly string[];
}> {
  override get message(): string {
    return [
      `Too many base branch candidates: ${this.candidates.join(" ")}.`,
      "Specify at most one base branch besides manual or auto.",
    ].join(" ");
  }
}

/**
 * スキルの引数をそのまま受け取り、baseブランチの指定を取り出します。
 *
 * スキルの引数は確認モードとbaseブランチを順不同で並べたものです。
 * 確認モードの解釈はスキル側が行うため、
 * ここでは`manual`と`auto`に完全一致するトークンを読み捨てて、
 * 残りの1トークンをbaseブランチとして扱います。
 * `auto-deploy`のようなブランチ名を確認モードと取り違えないよう、
 * 部分一致では判定しません。
 */
export function parseSyncAndPushArgs(
  argv: readonly string[],
): Effect.Effect<SyncAndPushArgs, InvalidArgumentsError> {
  const candidates = argv.filter((arg) => arg !== "" && !confirmationModes.includes(arg));
  if (candidates.length > 1) {
    return Effect.fail(new InvalidArgumentsError({ candidates }));
  }
  return Effect.succeed({ base: Option.fromNullishOr(candidates[0]) });
}
