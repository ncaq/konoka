/**
 * 複雑な正規表現はシンタックスハイライトを壊しがちなので別ファイルに切り出しています。
 */

/**
 * GitHub PRのURLパターン。
 * `https://<host>/<owner>/<repo>/pull/<number>`形式にマッチします。
 * 末尾のサブパス(/files, /commits等)やクエリパラメータは無視します。
 */
export const prUrlPattern: RegExp = /^https?:\/\/([^/]+)\/([^/]+)\/([^/]+)\/pull\/(\d+)/;

/**
 * Gitリモートの各種URL形式にマッチするパターン。
 * HTTPS, SSH, git+ssh形式に対応しています。
 *
 * マッチする形式:
 * - `https://github.com/owner/repo.git`
 * - `https://github.com/owner/repo`
 * - `git@github.com:owner/repo.git`
 * - `git@github.com:owner/repo`
 * - `ssh://git@github.com/owner/repo.git`
 */
export const remoteUrlPatterns: readonly RegExp[] = [
  /^https?:\/\/[^/]+\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/,
  /^git@[^:]+:([^/]+)\/([^/]+?)(?:\.git)?\/?$/,
  /^ssh:\/\/[^/]+\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/,
];
