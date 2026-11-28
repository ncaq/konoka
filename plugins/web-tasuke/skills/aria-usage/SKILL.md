---
name: aria-usage
description: WAI-ARIA usage guidelines. Avoid redundant ARIA attributes. No ARIA is better than Bad ARIA. Use when writing or reviewing HTML/JSX with accessibility attributes.
user-invocable: false
---

# WAI-ARIAの使用指針

`role`属性と`aria-*`属性は、使わなければいけない理由があるときだけ書いてください。
[APGのRead Me First](https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/)にある通り、
悪いARIAよりもARIA無しのほうが良いからです。

## HTMLのセマンティクスとの関係

HTMLの要素と属性を目的通りに使えば、適切なロールや名前が暗黙のうちに付きます。
同じ内容を`role`属性や`aria-*`属性で書き足しません。

```html
<!-- 避ける: 暗黙のセマンティクスと同じ内容を書いている -->
<button role="button" aria-label="送信">送信</button>

<!-- 良い -->
<button>送信</button>
```

WAI-ARIAの属性は暗黙のセマンティクスを上書きします。
`<h1 aria-level="2">`は見出しレベル2として、
`<a role="menuitem">`はリンクではなくメニュー項目として、支援技術に伝わります。
誤った値を書くとアクセシビリティを下げてしまい、
しかも通常の動作確認ではその誤りに気付けません。
`role`属性で暗黙のロールを上書きすると、
その要素のネイティブの機能が損なわれることもあります。

`checked`属性のような強いネイティブセマンティクスは、逆にWAI-ARIAの属性値を無視します。
`<input type="checkbox" checked aria-checked="false" />`は、チェックされていると伝わります。

各要素の暗黙のセマンティクスは、
[HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/)
に定義されています。

## ロールは約束

`role`属性を指定した要素には、そのロールに期待される振る舞いを全て実装します。
ロールの指定は、期待されることをこの要素が全て満たしているという、ユーザへの約束だからです。

`<div role="button">`なら、クリックだけでなく、
キーボードでフォーカスできて、SpaceキーとEnterキーでも操作できる必要があります。
ネイティブの`<button>`要素は最初からこれらを満たしているので、
ネイティブの要素で書けるものはネイティブの要素で書きます。

## 誤った使用を避けるためのガイダンス

[ARIA in HTML](https://www.w3.org/TR/html-aria/#author-guidance-to-avoid-incorrect-use-of-aria)のガイダンスに従います。

- インタラクティブな要素を、非インタラクティブなロールで上書きしません。
  `<button>`に`role="heading"`を指定するなどです。
- 冗長なロールを指定しません。
  `<button>`に`role="button"`を指定するなどです。
- 副作用に気をつけます。
  `<summary>`に`role="button"`を指定すると、支援技術に伝わるべき情報が失われます。
- ARIAのルールとHTMLのルールの両方に従います。

## WAI-ARIAを使う場面

以下の場合はWAI-ARIAの属性を使います。

### HTMLのネイティブの機能だけではアクセシブルにできない場合

`<svg>`要素の暗黙のロールは`graphics-document`で、画像として扱われないことがあります。
画像として意味を伝える`<svg>`要素には、`role="img"`を明示して、`aria-label`属性で名前を付けます。
トグルボタンであることはHTMLだけでは表現できないので、`aria-pressed`属性で伝えます。

```html
<svg role="img" aria-label="エラー">...</svg>

<button aria-pressed="false">Mute</button>
```

[APGのPatterns](https://www.w3.org/WAI/ARIA/apg/patterns/)にあるTabsやTree Viewのように、
HTMLに対応する要素がないUIパターンにもWAI-ARIAが必要です。

### HTMLの標準の仕様では実現が難しいことをしている場合

セレクトボックスの選択肢にスタイルを当てる、数万行のテーブルを仮想化するなど、
`<select>`や`<table>`では実装できないことがあります。
ネイティブの要素を使うほうがリスクは低いので、本当に必要かを先に検討します。
必要なら、WAI-ARIAで少しでもアクセシブルにします。

### コードに大きな変更を加えづらい状況で、少しでもアクセシビリティを高めたい場合

長期間運用されたシステムで、要素の種類を変えるとスタイルが崩れるようなときは、
WAI-ARIAの属性を足すだけで多少改善できる可能性があります。
対症療法であり根本的な改善を目指すべきですが、現実的な選択肢として有効です。

## 出典

この文書は以下の著作物の内容を要約・改変して作成しています。

- [role属性とは、aria-\*属性とは、WAI-ARIAとは、いったい何なのか、いつ使うべきなのか](https://qiita.com/ymrl/items/6c9c059208ea11e6d7bc)
  - 著作者: [ymrl](http://www.ymrl.net/)
  - ライセンス: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
  - 本文書は原著作物を要約・再構成したものであり、原著作物そのものではありません
- [ARIA in HTML](https://www.w3.org/TR/html-aria/) (Copyright © W3C)
- [HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/) (Copyright © W3C)
- [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) (Copyright © W3C, W3C Software and Document License)
