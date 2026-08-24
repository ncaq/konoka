---
name: nix-store-scan
description: Never scan /nix/store without limits, such as shell wildcard/glob expansion or recursive search over the whole store, because it contains hundreds of thousands of entries and can crash the agent process via OOM. Resolve the exact store path with nix commands first and operate scoped to that single path, or cap depth and result count like fd --max-depth 1 --max-results. Use when searching, listing, or accessing files under /nix/store.
user-invocable: false
---

# /nix/storeの無制限な走査の禁止

`/nix/store`全体を無制限に走査する操作は禁止です。
ワイルドカード展開はその代表例ですが、
再帰検索や上限なしの全件列挙も同様に禁止です。

## 禁止される操作

- シェルのglob展開: `ls /nix/store/*ghc*`, `du -sh /nix/store/*`, `echo /nix/store/**/*.so`
- Claude CodeのGlobツールやGrepツールを`/nix/store`全体に向けること
- `rg`や`grep -r`を`/nix/store`全体に再帰させること
- `ls /nix/store`や`nix path-info --all`のような全件列挙を上限なしで実行すること

## なぜ危険か

- `/nix/store`直下だけで数十万エントリに達することが珍しくありません。
  glob展開はシェルが全エントリ名をメモリ上に構築・ソートするため、
  この時点で数十MBのメモリ消費が発生します。
- 展開結果を外部コマンドへ渡す場合は、
  `ARG_MAX`(通常2MiB)を超えて`E2BIG`で失敗します。
  失敗するのに展開のコストだけは支払うことになります。
- `echo`のような組み込みコマンドや`for`のような組み込み構文はエラーにならず、
  シェルがメモリと時間を消費し切った上で巨大な出力を生みます。
  組み込みや`xargs`を経由すれば安全になるわけではありません。
- `**`による再帰globは、
  zshやbashの`globstar`有効時にはストア全体の数百万から数億のファイルを走査し、
  時間とメモリを大量に消費します。
  `globstar`が無効な既定のbashでも`**`は`*`と同義なので、
  `/nix/store/*/*.so`相当の数十万エントリ規模の展開が起きて危険です。
- Claude Codeのツール経由で実行した場合、
  巨大な結果をClaude Code本体のプロセスが蓄積するため、
  シェルの子プロセスではなくClaude Code自身がOOM Killerに殺されます。
- 仮に完走しても巨大な出力がコンテキストを圧迫します。

## 原則

ストア全体を無制限に走査しないことが原則です。
Nixのメタデータで正確なストアパスを1つ特定してから、
そのパスに限定して操作するのが基本形です。
ストア全体を対象にする場合は、
深さと件数の上限を必ず付けてください。
これが許されるのは`fd`のように、
上限で走査自体を打ち切れるツールに限ります。
内容検索は常に単一ストアパスに限定してください。

## タスク別の代替手段

| やりたいこと                       | 使うコマンド                                             |
| ---------------------------------- | -------------------------------------------------------- |
| パッケージのストアパスを知る       | `nix eval --raw 'nixpkgs#hello.outPath'`                 |
| 中身を見るためにrealiseする        | `nix build --no-link --print-out-paths 'nixpkgs#hello'`  |
| PATH上のコマンドの実体を知る       | `readlink -f "$(command -v hello)"`                      |
| 依存クロージャを列挙する           | `nix path-info -r /nix/store/<path>`                     |
| 依存している理由を調べる           | `nix why-depends /nix/store/<from> /nix/store/<to>`      |
| ストア直下を名前で探す             | `fd --max-depth 1 --max-results 20 'pattern' /nix/store` |
| 特定ストアパス直下のファイル一覧   | `nix store ls /nix/store/<path>`                         |
| 特定ストアパス内をパターンで探す   | `fd 'pattern' /nix/store/<path>`                         |
| ファイル内容を検索する             | `rg 'pattern' /nix/store/<path>`                         |
| ファイルを提供するパッケージを探す | `nix-locate 'bin/hello'`([nix-index]が必要)              |

[nix-index]: https://github.com/nix-community/nix-index

`nix eval --raw`は評価だけで即座に返り、
ビルドもダウンロードも発生しません。
パス文字列を知りたいだけならこちらを使ってください。
`fd`や`rg`でパスの中身を見るには実体が必要なので、
その場合に限って`nix build`でrealiseしてください。

## fdとrgが安全な理由と注意点

`fd`と`rg`は引数リストを構築せずにストリーミングで走査するため、
glob展開のようにメモリを一気に消費しません。

ただしストリーミングでも`/nix/store`全体の再帰走査は時間と出力量の問題が残るため、
必ず範囲か件数を絞ってください。

- `fd`: `--max-depth 1`で直下のみに限定し、`--max-results`で件数上限を付ける
- `rg`: 検索対象を特定のストアパスに限定する。全体への再帰は絞っても禁止。
  内容検索は該当が見つかるまで全ファイルを開いて読む必要があるため、
  件数の上限を付けても走査自体を早期に打ち切れない
