/**
 * 複雑な正規表現はシンタックスハイライト壊しがちなので別ファイルに切り出しています。
 */

/**
 * GitHub PRのURLパターン。
 * `https://<host>/<owner>/<repo>/pull/<number>`形式にマッチします。
 * 末尾のサブパス(/files, /commits等)やクエリパラメータは無視します。
 */
export const prUrlPattern: RegExp = /^https?:\/\/([^/]+)\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
