---
name: nix-store-scan
description: Never scan /nix/store without limits, such as shell wildcard/glob expansion or recursive search over the whole store, because it contains hundreds of thousands of entries and can crash the agent process via OOM. Resolve the exact store path with nix commands first and operate scoped to that single path, or cap depth and result count like fd --max-depth 1 --max-results. Use when searching, listing, or accessing files under /nix/store.
user-invocable: false
---

# /nix/storeを無制限に走査しない

`/nix/store`全体を、上限を付けずに走査しないでください。
`/nix/store`は直下だけで数十万エントリに達することが珍しくありません。
Claude Codeのツール経由で走査すると、巨大な結果をClaude Code本体のプロセスが蓄積するので、
シェルの子プロセスではなくClaude Code自身がOOM Killerに殺されます。
完走しても、巨大な出力がコンテキストを圧迫します。

Nixのメタデータで正確なストアパスを1つ特定してから、そのパスに限定して操作するのが基本です。
ストア全体を対象にする場合は、深さと件数の両方に上限を付けます。
これが許されるのは、`fd`のように`--max-depth`で走査の範囲そのものを限定でき、
ファイルの内容を開かないので1エントリあたりのコストが小さいツールだけです。
ファイルの内容の検索は、常に単一のストアパスに限定します。

## 無制限な走査に当たる操作

- シェルのglob展開。
  `ls /nix/store/*ghc*`、`du -sh /nix/store/*`、`echo /nix/store/**/*.so`などです。
- Claude CodeのGlobツールやGrepツールを`/nix/store`全体に向けること。
- `rg`や`grep -r`を`/nix/store`全体に再帰させること。
  内容の検索は該当が見つかるまで全てのファイルを開いて読むので、
  件数の上限を付けても走査を早期に打ち切れません。
- `ls /nix/store`や`nix path-info --all`のような全件の列挙。
  全件を読み終えてから出力するので、`head`などで出力を絞っても走査は打ち切れません。

glob展開が危険な理由は以下の通りです。

- シェルが全てのエントリ名をメモリ上に構築してソートするので、
  展開した時点で数十MBのメモリを消費します。
- 展開結果を外部コマンドに渡すと、`ARG_MAX`(通常2MiB)を超えて`E2BIG`で失敗します。
  失敗するのに、展開のコストだけは支払うことになります。
- `echo`のような組み込みコマンドや`for`のような組み込み構文はエラーにならず、
  シェルがメモリと時間を消費し切った上で巨大な出力を生みます。
  組み込みや`xargs`を経由しても安全にはなりません。
- `**`による再帰globは、zshや`globstar`を有効にしたbashでは、
  ストア全体の数百万から数千万のファイルを走査します。
  `globstar`が無効な既定のbashでも`**`は`*`と同義なので、
  `/nix/store/*/*.so`相当の数十万エントリ規模の展開が起きます。

## 代替手段

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

パスの文字列を知りたいだけなら、`nix build`ではなく`nix eval --raw`を使います。
`nix eval --raw`ではrealiseが発生しません。
評価キャッシュが温まっていれば即座に返り、
初回はnixpkgsの取得と評価のコストがかかりますが、
それでも数GBの転送や長時間のビルドが起き得る`nix build`よりは大幅に軽いためです。
`fd`や`rg`でパスの中身を見るには実体が必要なので、
その場合に限って`nix build`でrealiseします。

`fd`と`rg`は引数リストを構築せずにストリーミングで走査するので、
glob展開のようにメモリを一気に消費することはありません。
それでも`/nix/store`全体の再帰的な走査には時間と出力量の問題が残るので、
`rg`は特定のストアパスに限定し、
`fd`でストア直下を探すときは`--max-depth 1`と`--max-results`を両方付けます。

`--max-results`が走査を打ち切るのは、ヒットが上限に達した場合だけです。
ヒットしない場合は直下の全てのエントリを列挙し切ります。
見つからずに探し直すよりも、
先に`nix eval`や`nix-locate`で正確な名前やパスを特定するほうが確実です。
