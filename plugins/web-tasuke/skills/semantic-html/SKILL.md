---
name: semantic-html
description: Use semantic HTML elements instead of div. Use when writing or reviewing JSX/HTML markup in React or web components.
user-invocable: false
---

# セマンティックHTML

## 原則

意味のある構造には`<div>`ではなく、なるべくセマンティックHTML要素を使ってください。
`<div>`にコメントで意味を補足するぐらいなら、適切な要素を選ぶべきです。
セマンティック要素はアクセシビリティツール、LLM、人間のいずれにとっても読みやすくなります。

`<div>`はスタイリング目的のグルーピングなど、意味を持たないコンテナとしてのみ使います。

## 要素の使い分け

### `<main>`

ページの主要コンテンツです。
1ページにつき1つだけ使います。

```tsx
<main>
  <h1>ページタイトル</h1>
  <section>...</section>
  <section>...</section>
</main>
```

### `<article>`

独立して意味をなすコンテンツです。
ブログ記事、コメント、カードなどが該当します。

```tsx
<article>
  <h3>記事タイトル</h3>
  <p>{content}</p>
</article>
```

### `<section>`

見出し(`<h1>`-`<h6>`)を伴うコンテンツのまとまりに使います。
ページ内の各セクション、フォームのグループなどが該当します。

```tsx
// Good
<section>
  <h3>承認セクション</h3>
  <textarea />
  <button>承認</button>
</section>

// Bad
<div>
  <h3>承認セクション</h3>
  <textarea />
  <button>承認</button>
</div>
```

### `<header>`

セクションやページの導入部分です。
タイトル、ロゴ、ナビゲーションなどを含みます。

```tsx
<header>
  <h1>ページタイトル</h1>
  <StatusBadge status={status} />
</header>
```

### `<footer>`

セクションやページの末尾です。
関連リンク、アクションボタン群などを含みます。

```tsx
<footer>
  <button>キャンセル</button>
  <button>保存</button>
</footer>
```

### `<nav>`

主要なナビゲーションリンクのまとまりです。
サイドバーメニュー、パンくずリスト、ページ内リンクなどが該当します。

```tsx
<nav>
  <a href="/dashboard">ダッシュボード</a>
  <a href="/settings">設定</a>
</nav>
```

### `<aside>`

メインコンテンツに対する補足情報です。
サイドバー、注釈、関連リンクなどが該当します。

```tsx
<aside>
  <h4>関連情報</h4>
  <ul>...</ul>
</aside>
```

## `<div>`を使ってよい場合

- Flexbox/Gridなどレイアウト目的のラッパー
- スタイリングのためだけのグルーピング
- 上記のどのセマンティック要素にも該当しないコンテナ
