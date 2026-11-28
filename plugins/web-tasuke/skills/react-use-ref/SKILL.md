---
name: react-use-ref
description: Avoid unnecessary useRef in React. Prefer HTML standard features, declarative libraries, state, or custom hooks. Use when writing or reviewing React components.
user-invocable: false
---

# useRefの使用を避ける

`useRef`を使う前に、代替手段がないかを検討してください。
`useRef`は命令的なコードになりやすく、Reactの宣言的なモデルと相性がよくないためです。

- `ref.current`はミュータブルで、レンダリングのサイクルと同期しません。
  値を変えてもUIに反映されず、「いつ読んでも最新」という暗黙の前提に頼るので、
  予期しない挙動を起こしやすく、データの流れも追いにくくなります。
- 命令的なDOM操作は、Reactの状態管理との二重管理になりやすいです。
- DOMの状態をテストするにはDOMのセットアップが必要なので、テストが難しくなります。
- DOMの構造に依存したロジックは別の場所で使い回しにくく、コンポーネントの再利用性が下がります。

## 代替手段

- HTML標準の要素や属性を使う。最初に検討します。
  `<details>`、`<dialog>`、`popover`属性、`<input type="date">`など、
  以前はJavaScriptが必要だった機能の多くが、今はHTML標準で宣言的に書けます。
- DOM操作を抽象化する宣言的なライブラリを使う。
  例えば`IntersectionObserver`は、`useRef`と`useEffect`で管理せずに、
  `react-intersection-observer`の`useInView`に任せます。
- stateで管理する。
  レンダリングに反映する値を`useRef`で持っているなら、`useState`に置き換えます。
- `useEffect`の中のローカル変数で済ませる。
  タイマーのIDのように`useEffect`の中だけで使う値は、`useEffect`のクロージャの中で持てば足ります。

```tsx
// 避ける
const popoverRef = useRef<HTMLDivElement>(null);
const showPopover = () => popoverRef.current?.showPopover();

// 良い
<button popoverTarget="my-popover">開く</button>
<div id="my-popover" popover="auto">ポップオーバーの内容</div>
```

## useRefが必要な場合

代替手段のどれでも書けずに`useRef`が必要な場合は、カスタムフックに切り出して、DOM操作の詳細を隠します。
利用する側のコンポーネントが、宣言的なインターフェースで使えるようになります。
フックを自分で書く前に、同等の機能を持つライブラリがないかを探します。

Canvasの操作、サードパーティのライブラリのインスタンスの管理、スクロール位置の制御のように、
本質的にDOMの直接操作が必要で、ここまでのどの方法でも解決できない場合は、`useRef`を直接使います。
