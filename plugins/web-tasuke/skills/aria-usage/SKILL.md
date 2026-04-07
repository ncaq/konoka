---
name: aria-usage
description: WAI-ARIA usage guidelines. Avoid redundant ARIA attributes. No ARIA is better than Bad ARIA. Use when writing or reviewing HTML/JSX with accessibility attributes.
user-invocable: false
---

# WAI-ARIAの使用指針

無意味で冗長なARIA属性の追加を避けてください。

この文書は以下の著作物の内容を要約・改変して作成しています。

- [role属性とは、aria-\*属性とは、WAI-ARIAとは、いったい何なのか、いつ使うべきなのか](https://qiita.com/ymrl/items/6c9c059208ea11e6d7bc)
  - 著作者: [ymrl](http://www.ymrl.net/)
  - ライセンス: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
  - 本文書は原著作物を要約・再構成したものであり、原著作物そのものではありません
- [ARIA in HTML](https://www.w3.org/TR/html-aria/) (Copyright © W3C)
- [HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/) (Copyright © W3C)
- [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) (Copyright © W3C, W3C Software and Document License)

## 暗黙のWAI-ARIAセマンティクス

HTMLの要素は暗黙のWAI-ARIAセマンティクスを持っています。
`role`属性や`aria-*`属性を書かなくても、
明示的に書いたのと同じ状態になっています。

たとえば`<button>`要素は、
WAI-ARIAの属性がなくても「ボタン」というロールと、
テキストコンテンツによる名前を持ちます。

```html
<!-- この2つは同じセマンティクスです。下のように書く必要はありません -->
<button>送信</button>
<button role="button" aria-label="送信">送信</button>
```

HTMLの要素や属性をそれらの目的通りに使っていれば、
適切な暗黙のWAI-ARIAセマンティクスが自動的に付与されます。
暗黙のセマンティクスの詳細は、
[HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/)
に定義されています。

## WAI-ARIAセマンティクスとHTMLのコンフリクト

WAI-ARIAの属性はHTMLの暗黙のセマンティクスを上書きします。
誤った属性値を使ってしまうとアクセシビリティを下げてしまいます。
しかも通常の動作確認ではその誤りに気付けません。

```html
<!-- h1要素は暗黙のうちにaria-level="1"を持つが、
     aria-level属性が明示的に指定されたことで見出しレベル2に変更されている -->
<h1 aria-level="2">これは見出しレベル2です</h1>
```

一方で`checked`属性のような「強いネイティブセマンティクス」はWAI-ARIAの属性値を無視します。

```html
<!-- aria-checkedは無視され、HTMLネイティブのchecked属性値のみが支援技術に提示される -->
<label>
  <input type="checkbox" checked="checked" aria-checked="false" />
  このチェックボックスは、チェックされているでしょうか?
</label>
```

## No ARIA is better than Bad ARIA

[APGのRead Me First](https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/)にある通り、
悪いARIAよりもARIA無しのほうが良いです。
この原則を理解するために、
2つの重要な考え方があります。

### ロールは約束である

```html
<div role="button">Place Order</div>
```

`role="button"`を指定した以上、
この要素はボタンとして完璧に振る舞わなければなりません。
クリックだけでなく、
キーボードでフォーカスできてSpaceキーやEnterキーでも操作できる必要があります。
ロールを指定するということは
「このロールに期待されることは、この要素がすべて満たしています」
というユーザーに対する約束です。

ネイティブの`<button>`要素を使えばこれらは最初から満たされています。

### ARIAは情報を隠すことも拡張することもできる

WAI-ARIAはHTMLのネイティブの機能を拡張できますが、
同時に隠してしまうこともあります。

```html
<!-- menuitemロールをつけることで、リンクがメニュー項目であることを伝えている -->
<a role="menuitem">Assistive tech users perceive this element as an item in a menu, not a link.</a>

<!-- aria-pressed属性でトグルボタンであることを伝えている。HTMLだけでは表現できない -->
<button aria-pressed="false">Mute</button>
```

拡張は強力ですが、
`role`属性が暗黙のロールを上書きしてしまうことで、
HTML要素のネイティブの機能が損なわれることもあります。

## ARIAの誤った使用を回避するためのガイダンス

[ARIA in HTML](https://www.w3.org/TR/html-aria/#author-guidance-to-avoid-incorrect-use-of-aria)では、
以下のガイダンスが示されています。

- インタラクティブな要素を非インタラクティブなロールで上書きしない(`<button>`に`role="heading"`を指定するなど)
- 冗長なロールの指定を避ける(`<button>`に`role="button"`を指定するなど)
- 副作用に気をつける(`<summary>`に`role="button"`を指定すると、支援技術に伝わるべき情報が失われる)
- ARIAのルールを遵守する
- HTMLのルールを遵守する

## WAI-ARIAを使うべき場面

WAI-ARIAの属性は「使わなければいけない理由がなければ使わない」ようにすべきです。
以下のような場合にのみ使用してください。

### HTMLのネイティブの機能だけではアクセシブルにできないとき

```html
<!-- img要素は暗黙のimgロールを持ち、alt属性が名前となる -->
<img src="error.png" alt="エラー" />

<!-- svg要素は暗黙のロールがgraphics-documentで「画像」として扱われないことがある
     そのためimgロールを明示し、aria-label属性で名前をつけている -->
<svg role="img" aria-label="エラー">...</svg>
```

[APGのPatterns](https://www.w3.org/WAI/ARIA/apg/patterns/)にあるTabsやTree Viewなど、
HTMLに対応する要素がないUIパターンもWAI-ARIAが必要です。

### HTMLの標準の仕様では実現が難しいことをしているとき

セレクトボックスの選択肢にスタイルを当てたい場合や、
数万行のテーブルを仮想化したい場合など、
`<select>`や`<table>`では実装できないケースがあります。

HTMLのネイティブ要素を使うほうがリスクは低いため、
本当に必要かは検討すべきですが、
やる必要があるならWAI-ARIAで少しでもアクセシブルにしてください。

### コードに大きな変更を加えづらい状況で、少しでもアクセシビリティを高めようとしているとき

長期間運用されたシステムで要素の種類を変えるとスタイルが崩れるような場合、
WAI-ARIAの属性を足すだけで多少改善できる可能性があります。
あくまで対処療法であり根本的な改善を目指すべきですが、
現実的な選択肢として有効です。
