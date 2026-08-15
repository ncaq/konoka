/**
 * PR URLのホストとOctokitクライアントの向き先の一致を検証するモジュール。
 *
 * `parsePrUrl`が抽出したhostはクライアントの向き先には反映されず、
 * クライアントは環境変数のみでbaseUrlを決定します。
 * そのまま進めると環境変数がgithub.comを指す状態でGitHub EnterpriseのURLを渡した場合などに、
 * 無言で別ホストの同名リポジトリを対象にしてしまうため、
 * 食い違いを検出した時点でエラーにします。
 */

import { Data, Effect } from "effect";
import { getClientWebHost, type EnvVarInvalidUrl } from "./client";
import type { RespondContext } from "./context-type";

/** URLで指定されたホストとクライアントの向き先が一致しない場合の失敗。 */
export class HostMismatch extends Data.TaggedError("HostMismatch")<{
  readonly contextHost: string;
  readonly clientHost: string;
}> {
  override get message(): string {
    return (
      `PR URL host "${this.contextHost}" does not match GitHub client host "${this.clientHost}". ` +
      "GITHUB_API_URLやGH_HOST等の環境変数をPRのホストに合わせるか、正しいホストのURLを指定してください。"
    );
  }
}

/**
 * コンテキストにホスト情報がある場合、クライアントの向き先と一致することを検証します。
 * ホスト情報がない(ローカル解決由来の)コンテキストでは何もしません。
 */
export function verifyContextHost(
  context: RespondContext,
): Effect.Effect<void, HostMismatch | EnvVarInvalidUrl> {
  const contextHost = context.host;
  if (contextHost == null) {
    return Effect.void;
  }
  return Effect.gen(function* () {
    const clientHost = yield* getClientWebHost();
    if (clientHost !== contextHost) {
      return yield* new HostMismatch({ contextHost, clientHost });
    }
  });
}
