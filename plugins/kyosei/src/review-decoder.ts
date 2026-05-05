/**
 * レビュー投稿用のJSON入力をデコード・バリデーションするモジュール。
 */

import { Schema } from "effect";
import { ReviewSubmissionSchema } from "./review-schema";

/**
 * JSON文字列をパース・バリデーションして`ReviewSubmission`に変換します。
 * JSONパースまたはバリデーション失敗時はエラーメッセージを含む例外をスローします。
 */
export function decodeReviewSubmission(input: string): typeof ReviewSubmissionSchema.Type {
  return Schema.decodeUnknownSync(Schema.parseJson(ReviewSubmissionSchema), { onExcessProperty: "error" })(input);
}
