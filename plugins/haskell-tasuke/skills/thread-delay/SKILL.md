---
name: thread-delay
description: Avoid overusing threadDelay because time-dependent code is unstable and unportable. Prefer synchronization variables like TMVar or retry combinators. Use when writing or reviewing Haskell code that delays threads, waits, or polls.
user-invocable: false
---

# `threadDelay`の乱用を避ける

`threadDelay`の乱用は避けてください。
何かを待つ処理は、決め打ちの時間だけ止めるのではなく、後述の同期変数かリトライで書きます。

時間に依存するコードは安定性と移植性が低いからです。
次の実行でも、他のマシンでも、同じ時間で処理が完了するとは限りません。
また、待つように命令した時間だけ実行が必ず止まるので、その分だけ遅くなります。

## 代替手段

Haskellの別のスレッドの実行を待つ場合など、同期変数が使える場合は`TMVar`などで待ちます。
時間に頼らず正確に同期できます。

言語の外部のデータやイベントに依存する場合は、
[retry: Retry combinators for monadic actions that may fail](https://hackage.haskell.org/package/retry)
パッケージなどを使って細かくリトライします。
短い間隔から始めて待機時間をだんだん増やすので、
固定の時間を待つよりも実行の止まる時間が短くなることが見込めます。
最大の待機時間を固定の値より大きく取れるので、実行の安定も見込めます。

リトライポリシーは以下のように選びます。

- ネットワークを経由する場合は、基本的に`fullJitterBackoff`を使います。
  待機時間を増やしていく上に、乱数が入るので複数の端末の衝突をある程度避けられます。
- `MonadIO`の文脈を入れたくない場合や、もう少し単純でよい場合は、`exponentialBackoff`も選択肢です。
- 待機時間が固定でないと不都合がある場合は`constantDelay`を使います。

どのポリシーでも、全体の待機できる時間は`limitRetriesByCumulativeDelay`で制限します。

## `threadDelay`を使ってよい場合

意図的にスレッドを永久に止める場合は、以下のように書いて構いません。
そのスレッドが持つリソースをGCに回収させずに保持するために、
永久に止める必要があることがあります。

```haskell
forever $ threadDelay maxBound
```

テストコードでは、対象のロジックに完了を待つ手段が実装されておらず、
同期変数を組み込むとロジックが複雑になるような場合に、`threadDelay`を使って構いません。
テストコードは壊れても致命的ではないからです。
ただし使う前に、他の方法で書けないかを検討してください。
リトライで書けば、だいたいの場合は`threadDelay`よりましになります。
