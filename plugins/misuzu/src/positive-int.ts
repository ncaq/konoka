/**
 * 複数のスキーマで共有する正の整数の定義。
 * PR番号やdatabase IDや行番号など、GitHubが1始まりで採番する値に使います。
 */

import { Schema } from "effect";

/** 正の整数。 */
export const PositiveIntSchema = Schema.Int.check(Schema.isGreaterThan(0));
