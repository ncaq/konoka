---
name: react-use-effect
description: Avoid unnecessary useEffect in React. Prefer direct computation, event handlers, key props, useMemo, or data fetching libraries. Use when writing or reviewing React components.
user-invocable: false
---

# useEffectの使いどころを見極める

`useEffect`は外部システム(ブラウザAPI、ネットワーク、サードパーティライブラリ)との同期にのみ使います。
それ以外の用途では、より適切な代替手段がないか検討してください。

参考: [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

## useEffectを使わずに解決するパターン

### レンダリング用のデータ変換は直接計算します

```tsx
// Bad: useEffectでstateを更新
const [fullName, setFullName] = useState("");
useEffect(() => {
  setFullName(firstName + " " + lastName);
}, [firstName, lastName]);

// Good: レンダリング中に計算
const fullName = firstName + " " + lastName;
```

### ユーザー操作の処理はイベントハンドラで行います

```tsx
// Bad: useEffectで副作用を検知
useEffect(() => {
  if (product.isInCart) {
    showNotification(`Added ${product.name} to cart!`);
  }
}, [product]);

// Good: イベントハンドラで直接処理
function handleBuyClick() {
  addToCart(product);
  showNotification(`Added ${product.name} to cart!`);
}
```

### propsが変わったときの状態リセットにはkeyを使います

```tsx
// Bad: useEffectでリセット
useEffect(() => {
  setComment("");
}, [userId]);

// Good: keyでコンポーネントを再マウント
<Profile userId={userId} key={userId} />;
```

### 高コストな計算のキャッシュにはuseMemoを使います

```tsx
// Bad: useEffectで計算結果をstateに保存
useEffect(() => {
  setFilteredTodos(getFilteredTodos(todos, filter));
}, [todos, filter]);

// Good: useMemoでキャッシュ
const filteredTodos = useMemo(() => getFilteredTodos(todos, filter), [todos, filter]);
```

### データ取得にはデータフェッチライブラリを使います

```tsx
// Bad: useEffectで手動フェッチ(冗長なボイラープレート、キャッシュなし、重複排除なし)
useEffect(() => {
  let ignore = false;
  fetchData(id).then((data) => {
    if (!ignore) setData(data);
  });
  return () => {
    ignore = true;
  };
}, [id]);

// Good: TanStack Query等を使う
const result = useSuspenseQuery({ queryKey: ["data", id], queryFn: () => fetchData(id) });
```

## useEffectが適切なケース

- ブラウザAPIとの同期(`IntersectionObserver`、`ResizeObserver`など)
- サードパーティライブラリの初期化・破棄
- 外部接続の管理(WebSocketなど)

これらの場合でも、
より高抽象度なhooksやライブラリが使えないか検討してください。

## useEffectを使う場合はカスタムフックに切り出す

コンポーネント本体に`useEffect`を直接書くことは禁止です。
必ずカスタムフックに切り出し、コンポーネント側はそのフックを呼ぶだけにしてください。

カスタムフックには責務を表す名前をつけます。
`useDocumentTitle`, `useWindowResize`, `useDeviceListSubscription`など。
フックの配置場所はプロジェクトの規約に従ってください。
典型的には`src/hooks/`のような共有ディレクトリか、
そのコンポーネントに固有のものであれば同じディレクトリの別ファイルに置きます。
