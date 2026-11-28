---
name: react-component-convention
description: React component file conventions covering structure ordering, one-component-per-file, and splitting bloated components. Use when writing or reviewing React components.
user-invocable: false
---

# Reactコンポーネントの規約

## ファイル内の順序

コンポーネントのファイルは、importに続けて以下の順に書きます。

- デザイン定義: `sva`、`cva`、`css`などのstyled-systemの呼び出し
- props定義: `type Props = ...`や`interface Props { ... }`
- 関数コンポーネントの定義: `export const Foo: React.FC<Props> = ...`や
  `export function Foo(props: Props): React.ReactElement { ... }`

見た目、インターフェース、振る舞いという責務の分離をファイルの縦の並びで表して、
どのコンポーネントも同じ段階を踏んで読めるようにするためです。

デザイン定義は、純粋に振る舞いだけのコンポーネントでは省略できます。
それ以外に、この順序を変えてよい場合はありません。

## 1ファイル1コンポーネント

1つのファイルに書くコンポーネントは、exportするかどうかに関わらず1つだけです。
そのファイルの中で使い回す小さなコンポーネントが必要になった場合も、別のファイルに切り出します。

切り出し先のファイル名は、IDEのQuick Openで識別しやすい名前にします。
`index.tsx`や`index.ts`のような汎用の名前のファイルは新しく作りません。
既存の`index.tsx`を大幅に書き換えるときは、リファクタリングの一環として識別しやすい名前に変えます。

例外として、他のコンポーネントのrender propに渡すためのごく小さなコンポーネントは、
以下を全て満たす場合に限り、同じファイルの中で定義できます。
`<DataGrid renderRow={...} />`、`columns[i].render`、
`react-hook-form`の`Controller`の`render`などに渡すものが該当します。

- render propの関数の引数の型にそのまま当てはまる、数行から十数行程度の軽量なものである。
- ファイルの中で1度しか使わない。
  使い回す可能性が出てきた時点で別のファイルに切り出します。
- どのrender propに渡すために定義しているのかを説明するコメントを、直前に書いている。

```tsx
// DataGridのrenderRowに渡すための行コンポーネント。このファイル内でしか使わない
const DeviceRow: React.FC<{ device: Device }> = ({ device }) => (
  <tr>
    <td>{device.id}</td>
    <td>{device.name}</td>
  </tr>
);
```

条件を満たさないコンポーネントと、
render propに渡すのではなく通常のJSXの一部として使うコンポーネントは、別のファイルに切り出します。

## 肥大化したコンポーネントの分割

関数の始まりからJSXが現れるまでに30行程度かかっているなら、
コンポーネントが責務を持ちすぎている兆候です。
以下のいずれかの方法で責務を外に出します。

- ロジックをカスタムフックに切り出す。
  state、副作用、メモ化、ハンドラの寄せ集めは、ほぼ常にフックにできます。
- 表示のまとまりを子コンポーネントに切り出す。
- 算出値をモジュールスコープの純粋関数に切り出す。

JSXは、長いこと自体が悪いわけではありません。
行数ではなく認知負荷で判断し、他人がそのコンポーネントを上から下まで一気に読めるかを基準にします。
単純な要素が整然と並んで長いだけなら、分割する必要はありません。
以下の状態は危険信号として扱い、分割を検討します。

- 同じ構造が縦に並んでいるのに、わずかな差異のせいで繰り返しにまとめられていない。
- 条件分岐ごとにJSXの枝が分かれていて、どの枝が描画されるのかを頭の中で追う必要がある。
- 1つの要素のクラス名やpropsを組み立てるために、手前で何段ものローカル変数を用意している。
- ユーザー情報、支払い情報、通知設定のような複数のドメイン概念を、同じブロックの中で扱っている。
