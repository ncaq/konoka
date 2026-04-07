---
name: window-alert-confirm
description: Guidelines for using window.alert() and window.confirm() in web applications. Use when implementing error notifications or destructive action confirmations.
user-invocable: false
---

# `window.alert`と`window.confirm`の使用指針

## 利点

`window.alert()`と`window.confirm()`はブラウザ標準のAPIです。
以下の利点があるため、適切な場面では使います。

- 実装コストがゼロです。UIコンポーネントの作成やstate管理が不要です
- ブラウザ標準APIのため、キーボード操作やスクリーンリーダーへの対応など最低限のアクセシビリティが確保されています
- メインスレッドをブロックするため、ユーザーが確実に気づきます
- `confirm()`の戻り値で同期的に分岐できるため、コードがシンプルになります

## 既知の欠点

- メインスレッドを完全にブロックするため、JS実行・アニメーション・タイマーが停止します
- ユーザーが「このページでこれ以上のダイアログを表示しない」を選択すると、
  ブラウザが抑制し`confirm()`が常に`false`になる可能性があります
- Chrome M92以降、クロスオリジンiframe内からの呼び出しは無効化されています

### iOS Safariの`history.pushState`との組み合わせの問題

iOS Safariでは`history.pushState()`で追加された履歴エントリにブラウザバック(スワイプバック含む)で戻ると、
その後の`alert()`/`confirm()`/`prompt()`がサイレントに無視されます。
`confirm()`は常に`false`を返します。

このバグはiOS 9.3頃から報告されており、
iOS 18時点でも修正されていません。
WebKit Bugzillaに公開チケットはなく、
Apple内部のRadarで管理されていると推測されています。
WebKitチームはユーザーインタラクションなしの`pushState`エントリのスキップを、
意図的なセキュリティ強化として扱っている面もあり、
根本的な修正の見通しは不明です。

Apple Developer Forumでの[報告](https://developer.apple.com/forums/thread/684407)で、
iOS 17/18でも再現が確認されています。
WebKit Bugzillaの[#248303](https://bugs.webkit.org/show_bug.cgi?id=248303)は、
直接にはpopstateイベントの問題ですが、
`pushState`エントリのスキップという根本原因が共通しています。

SPA的なhistory操作を行うアプリケーションでは、
この問題に該当する可能性があるため注意が必要です。

## 使用が適切なケース

- サーバが壊れている場合でもないと発生しないであろう稀なAPIエラーやサーバエラーの通知
- 致命的エラーでページ操作を完全にブロックする必要がある場合
- データの削除など、重要な操作の確認

## 使用を避けるべきケース

- フォームのバリデーションエラー: フォームライブラリでインライン表示してください
- ユーザー確認が必要な通常フロー: HTMLの`<dialog>`要素の`showModal()`やUIライブラリの機能を使ってください
- 頻繁に発生しうる操作結果の通知: トースト通知などを使ってください
- クロスオリジンiframe内で動作するアプリケーション: ブラウザにブロックされるため使えません
