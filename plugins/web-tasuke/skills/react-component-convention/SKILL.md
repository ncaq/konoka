---
name: react-component-convention
description: React component file conventions covering structure ordering, one-component-per-file, and splitting bloated components. Use when writing or reviewing React components.
user-invocable: false
---

# Reactコンポーネントの規約

## ファイル内の構造順序を守る

すべてのコンポーネントファイルは、上から順に次の流れで構成します。

1. デザイン定義 — `sva`/`cva`/`css`などのstyled-system呼び出し
2. props定義 — `type Props = ...`や`interface Props { ... }`
3. Functional Component定義 — `export const Foo: React.FC<Props> = ...`や`export function Foo(props: Props): React.ReactElement { ... }`

import群は当然この前に置きます。
純粋な振る舞いだけのコンポーネントならデザイン定義は省略可能ですが、
それ以外で順序の入れ替えは認めません。

理由: 「見た目」「インターフェース」「振る舞い」の責務分離をファイル内の縦方向で表現することで、
コンポーネントを読むときの認知の階段を一定に保つため。

## 1ファイル1コンポーネント

1つのファイルの中にexport/非exportを問わずコンポーネントを2つ以上書かないでください。

ファイル内で再利用される小さなコンポーネントが必要になった場合は、必ず別ファイルに切り出します。
切り出した先のファイル名はIDEのQuick Openで識別しやすい名前にし、
`index.tsx`や`index.ts`といった汎用名を新規作成しないでください。
既存の`index.tsx`を大幅に書き換える場合も、
リファクタリングの一環として適切なファイル名にリネームします。

例外として、他のコンポーネントのrender propに渡すためのごく小さなコンポーネントは、
その場で定義することを許容します。
`<DataGrid renderRow={...} />`や`columns[i].render`、
`react-hook-form`の`Controller`の`render`などが該当します。
ただし次の条件をすべて満たすこと。

- 呼び出し元のrender関数の引数型にそのまま当てはめられる、数行〜十数行程度の軽量なものに限る
- ファイル内で1度しか使われない。使い回される可能性が出てきた時点で別ファイルに切り出す
- どのrender propに渡すために定義しているのかを説明するコメントを直前に付ける

例:

```tsx
// DataGridのrenderRowに渡すための行コンポーネント。このファイル内でしか使わない
const DeviceRow: React.FC<{ device: Device }> = ({ device }) => (
  <tr>
    <td>{device.id}</td>
    <td>{device.name}</td>
  </tr>
);
```

ファイル内で複数回使う場合、それなりの行数がある場合、
呼び出し側から渡される関数でなく通常のJSXの一部として使っている場合などは、
必ず別ファイルに切り出してください。

## コンポーネントが肥大化してきたら分割する

「関数の始まりからJSXが登場するまでに30行程度かかっている」状態は、
コンポーネントが過剰な責務を持っている兆候です。
次のいずれかの方法で責務を逃します。

- ロジックをカスタムフックに切り出す。state、副作用、メモ化、ハンドラの寄せ集めはほぼ必ずフック化できます
- 表示の塊を子コンポーネントに切り出す
- 算出値をモジュールスコープの純粋関数に切り出す

ただし、JSX自体が長くなることは必ずしも悪ではありません。
判定すべきは「行数」ではなく「認知負荷」です。
次のような状態は危険信号として扱ってください。

- 同一の構造が縦に並んでいるが、わずかな差異があってループに落とせていない
- 条件分岐ごとにJSXの枝が派生しており、どの枝が描画されるかを脳内でトラッキングする必要がある
- 1つの要素のクラス名/propsを組み立てるために手前で何段ものローカル変数を準備している
- 同じblock内でユーザー情報・支払い情報・通知設定のように複数のドメイン概念を扱っている

逆に、整然と並んだ単純な要素列が長いだけであれば、無理に分割する必要はありません。
「他人がこのコンポーネントを上から下まで一気に読めるか」を基準にしてください。
