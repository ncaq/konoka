---
name: react-use-effect
description: Rules for useEffect usage in React including when to avoid it and when to extract it into custom hooks. Use when writing or reviewing React components that contain or might need useEffect.
user-invocable: false
---

# useEffectの使いどころを見極める

`useEffect`は、ブラウザAPI、ネットワーク、サードパーティのライブラリといった外部システムとの同期だけに使います。
それ以外の用途では、先に以下の代替手段を検討してください。

- レンダリング用のデータの変換は、stateに入れずにレンダリング中に直接計算します。
- 高コストな計算のキャッシュには`useMemo`を使います。
- ユーザー操作に伴う処理は、イベントハンドラの中で行います。
- propsが変わったときのstateのリセットには、`key`を使ってコンポーネントを再マウントします。
- データの取得には、TanStack Queryなどのデータフェッチライブラリを使います。
  `useEffect`での手動のフェッチは定型のコードが冗長で、キャッシュも重複の排除もありません。

```tsx
const result = useSuspenseQuery({ queryKey: ["data", id], queryFn: () => fetchData(id) });
```

参考: [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

## useEffectが適切な場合

- `IntersectionObserver`や`ResizeObserver`などのブラウザAPIとの同期
- サードパーティのライブラリの初期化と破棄
- WebSocketなどの外部接続の管理

これらの場合も、より抽象度の高いフックやライブラリが使えないかを先に検討します。

## カスタムフックに切り出す

`useEffect`は、コンポーネントの本体には直接書かず、カスタムフックに切り出します。
コンポーネントはそのフックを呼ぶだけにします。

カスタムフックには、`useDocumentTitle`、`useWindowResize`、`useDeviceListSubscription`のように、
責務を表す名前を付けます。
フックの置き場所はプロジェクトの規約に従います。
典型的には`src/hooks/`のような共有のディレクトリか、
そのコンポーネントに固有のフックであれば同じディレクトリの別のファイルです。
