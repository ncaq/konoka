---
name: thread-delay
description: Avoid overusing threadDelay because time-dependent code is unstable and unportable. Prefer synchronization variables like TMVar or retry combinators. Use when writing or reviewing Haskell code that delays threads, waits, or polls.
user-invocable: false
---

# `threadDelay`

## 乱用を避ける

`threadDelay`はスレッドを指定した時間だけ遅延させる関数です。

`threadDelay`を乱用するのはやめましょう。

時間に依存するコードは安定性や移植性が低いためです。

次の実行でも同じ時間で処理が完了するとは限りません。
他のマシンでは同じ時間で処理が完了しないかもしれません。

また必然的にその時間だけ実行がストップしてしまうので、
待つように命令した分だけ実行が遅くなります。

## 代替手段

### 同期変数

`TMVar`などの同期変数が使える場合は正確に同期できます。

Haskellの別のスレッドの実行を待つ場合などに使えます。

### リトライ

言語外部のデータやイベントに依存する場合は、
[retry: Retry combinators for monadic actions that may fail](https://hackage.haskell.org/package/retry)
パッケージなどを使って細かくリトライしてください。

短い単位の繰り返しからだんだん待機時間を増やしていくことで、
固定の待機をするよりは実行のストップが短くなることが見込めます。
また最大待機時間の値を固定値より大きくすることが許容できるため、
実行の安定も見込めます。

リトライポリシーとしては、
ネットワークを経由する場合は、
基本的に`fullJitterBackoff`を使うのが望ましいでしょう。
待機時間を増やしていきますし、
乱数を入れることで複数の端末が衝突することをある程度避けることが出来ます。

`MonadIO`の文脈を入れたくないとか、
もう少しシンプルでもいいなら、
`exponentialBackoff`も選択肢になります。

固定でなければ不都合がある場合は`constantDelay`を使うべきです。

全体の待機可能な時間は`limitRetriesByCumulativeDelay`で制限してください。

## 永久的な停止の意図

以下のように意図的に永久的にスレッドを停止する場合は問題ありません。

```haskell
forever $ threadDelay maxBound
```

そのスレッドが持つリソースを、
GCに回収されないように保持するために、
こういった永久的なsleepが必要な時もあります。

## テストコードでの利用

テストコードを書く時に、
ロジックに実行を待つ部分が実装されていない場合などは、
同期変数を組み込むとロジックを複雑にしてしまうことがあるので仕方ない時もあります。

テストコードなら壊れても致命的ではないので許容することもありますが、
やはり他の方法を使えないか検討するべきです。

とりあえずretry系統を使えばだいたいの場合は`threadDelay`を使うよりはマシになるでしょう。
