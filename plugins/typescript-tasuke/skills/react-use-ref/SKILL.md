---
name: react-use-ref
description: Avoid unnecessary useRef in React. Prefer HTML standard features, declarative libraries, state, or custom hooks. Use when writing or reviewing React components.
user-invocable: false
---

# useRefの使用を避ける

`useRef`は命令的なコードになりやすく、
Reactの宣言的なモデルと相性がよくありません。
使う前に代替手段がないか検討してください。

## なぜuseRefを避けたいのか

- `ref.current`はミュータブルであり、レンダリングサイクルと同期しません。値の変更がUIに反映されず、予期しない挙動を起こしやすいです
- 命令的なDOM操作はReactの状態管理と二重管理になりやすいです
- テストが難しくなります。DOMの状態をテストするにはDOMのセットアップが必要になります
- コンポーネントの再利用性が下がります。DOM構造に依存したロジックは別の場所で使い回しにくいです
- `ref.current`への代入は「いつ読んでも最新」という暗黙の前提に依存しており、データフローが追いにくくなります

## 代替手段の検討

### HTML標準の機能を使う

ブラウザが提供する宣言的なHTML要素や属性で解決できないか、
まず検討してください。

```tsx
// Bad: useRefで開閉を命令的に管理
const dialogRef = useRef<HTMLDialogElement>(null);
const openDialog = () => dialogRef.current?.showModal();
const closeDialog = () => dialogRef.current?.close();

// Good: HTML標準の要素で宣言的に表現
<details>
  <summary>詳細を表示</summary>
  <p>ここに詳細が表示されます。</p>
</details>

// Good: popover属性を使う
<button popovertarget="my-popover">開く</button>
<div id="my-popover" popover>ポップオーバーの内容</div>
```

`<details>`、`<dialog>`、`popover`属性、`<input type="date">`など、
以前はJavaScriptが必要だった機能の多くが現在はHTML標準で提供されています。

### 宣言的なライブラリを使う

DOM操作を抽象化してくれるライブラリがあれば、
そちらを優先してください。

```tsx
// Bad: useRefとuseEffectでIntersectionObserverを管理
const ref = useRef<HTMLDivElement>(null);
useEffect(() => {
  const observer = new IntersectionObserver(([entry]) => {
    setIsVisible(entry.isIntersecting);
  });
  if (ref.current) observer.observe(ref.current);
  return () => observer.disconnect();
}, []);

// Good: ライブラリに任せる(react-intersection-observerの例)
const { ref, inView } = useInView();
```

### stateで管理する

レンダリングに反映すべき値を`useRef`で持っているなら、
それは`useState`で管理すべきです。

```tsx
// Bad: useRefで値を保持してレンダリングと同期しない
const countRef = useRef(0);
countRef.current += 1;

// Good: stateで管理してUIに反映する
const [count, setCount] = useState(0);
```

### クロージャやローカル変数で済ませる

`useEffect`内だけで使う値は、
`useEffect`のクロージャ内で管理すれば十分です。

```tsx
// Bad: タイマーIDをuseRefで保持
const timerIdRef = useRef<number>();
useEffect(() => {
  timerIdRef.current = window.setInterval(() => {
    /* ... */
  }, 1000);
  return () => clearInterval(timerIdRef.current);
}, []);

// Good: useEffect内のローカル変数で完結
useEffect(() => {
  const timerId = window.setInterval(() => {
    /* ... */
  }, 1000);
  return () => clearInterval(timerId);
}, []);
```

### カスタムフックに抽出する

どうしても`useRef`が必要な場合は、
カスタムフックに抽出してDOM操作の詳細を隠蔽してください。
利用側のコンポーネントは宣言的なインターフェースで使えるようになります。

以下は説明のための簡易的な例です。
実際には同等の機能を提供するライブラリがないか先に探してください。

```tsx
// カスタムフックに抽出
function useResizeObserver<T extends HTMLElement>(callback: (entry: ResizeObserverEntry) => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const element = ref.current;
    if (element == null) return;
    const observer = new ResizeObserver(([entry]) => callback(entry));
    observer.observe(element);
    return () => observer.disconnect();
  }, [callback]);
  return ref;
}

// 利用側は宣言的
function ResizablePanel() {
  const ref = useResizeObserver<HTMLDivElement>((entry) => {
    console.log(entry.contentRect.width);
  });
  return <div ref={ref}>...</div>;
}
```

### useRefを直接使う

上記のいずれでも解決できない場合に`useRef`を直接使ってください。
Canvas操作、
サードパーティライブラリのインスタンス管理、
スクロール位置の制御など、
本質的にDOMの直接操作が必要な場面はあります。
