---
name: window-alert-confirm
description: Guidelines for using window.alert() and window.confirm() in web applications. Use when implementing error notifications or destructive action confirmations.
user-invocable: false
---

# `window.alert`と`window.confirm`の使用指針

`window.alert()`と`window.confirm()`には以下の利点があるので、適した場面では使います。

- 実装コストがゼロです。
  UIコンポーネントの作成も状態管理も要りません。
- ブラウザ標準のAPIなので、キーボード操作やスクリーンリーダーへの対応など、
  最低限のアクセシビリティが確保されています。
- メインスレッドをブロックするので、ユーザが確実に気づきます。
- `confirm()`の戻り値で同期的に分岐できるので、コードが単純になります。

## 使う場面

- サーバが壊れてでもいないと発生しないような、稀なAPIエラーやサーバエラーの通知
- 致命的なエラーで、ページの操作を完全にブロックする必要がある場合
- データの削除など、重要な操作の確認

## 避ける場面

- フォームのバリデーションエラー。
  フォームライブラリでインライン表示します。
- ユーザの確認が必要な通常のフロー。
  HTMLの`<dialog>`要素の`showModal()`か、UIライブラリの機能を使います。
- 頻繁に発生しうる操作結果の通知。
  トースト通知などを使います。
- クロスオリジンのiframeの中で動作するアプリケーション。
  Chrome M92以降、クロスオリジンのiframeの中からの呼び出しは無効化されていて、
  ブラウザにブロックされるので使えません。

## 既知の欠点

- メインスレッドを完全にブロックするので、JavaScriptの実行、アニメーション、タイマーが止まります。
- ユーザが「このページでこれ以上のダイアログを表示しない」を選ぶとブラウザがダイアログを抑制し、
  `confirm()`が常に`false`を返すようになる可能性があります。

### iOS Safariの`history.pushState`との組み合わせの問題

iOS Safariでは、`history.pushState()`で追加された履歴エントリに、
ブラウザバック(スワイプバックを含む)で戻ると、
その後の`alert()`、`confirm()`、`prompt()`が何も表示されずに無視されます。
`confirm()`は常に`false`を返します。

SPAのように`history`を操作するアプリケーションで`alert()`や`confirm()`を使う場合は、
この問題に該当する可能性を考慮してください。

この不具合はiOS 9.3頃から報告されていて、iOS 18の時点でも修正されていません。
WebKitチームは、ユーザの操作を伴わない`pushState`のエントリのスキップを、
意図的なセキュリティ強化として扱っている面もあり、根本的な修正の見通しは不明です。
`alert()`などが無視される問題そのものを扱うWebKit Bugzillaの公開チケットはなく、
Apple内部のRadarで管理されていると推測されています。

- Apple Developer Forumでの[報告](https://developer.apple.com/forums/thread/684407)で、
  iOS 17とiOS 18でも再現が確認されています。
- WebKit Bugzillaの[Bug 248303](https://bugs.webkit.org/show_bug.cgi?id=248303)は、
  直接にはpopstateイベントの問題ですが、
  `pushState`のエントリのスキップという根本原因が共通しています。
