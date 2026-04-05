---
name: nix-fast-build
description: nix-fast-build command reference. Parallel Nix evaluation and build tool using nix-eval-jobs. Use when running or configuring nix-fast-build.
user-invocable: false
---

# nix-fast-build

[Mic92/nix-fast-build](https://github.com/Mic92/nix-fast-build)は
[nix-eval-jobs](https://github.com/nix-community/nix-eval-jobs)と
[nix-output-monitor](https://github.com/maralorn/nix-output-monitor)を組み合わせて、
Nix式の評価を並列実行するツールです。

checksがビルドされるため、
適切にflake.nixで設定されていればリント・ビルド・テストが全て実行されます。

`nix flake check`と比べて評価が並列化されるため高速です。

## 典型的な使い方

### 手元のターミナルで実行する場合

```bash
nix-fast-build --option eval-cache false --no-link --skip-cached
```

nomによるリッチな出力が表示されます。

### Claude CodeやCIなど非対話環境で実行する場合

```bash
nix-fast-build --option eval-cache false --no-link --skip-cached --no-nom
```

nomはターミナル制御シーケンスに依存するため、
非対話環境では`--no-nom`を追加してください。

## IFDを使うプロジェクトでの注意

nix-fast-buildは`--systems`でビルド対象を絞っても、
評価は全アーキテクチャに対して行います。
IFD(Import From Derivation)は評価フェーズでderivationのビルドを要求するため、
ローカルでビルドできないアーキテクチャのIFDが走ってエラーになることがあります。

`nix flake check`はNix 2.16以降デフォルトで他システムの評価をスキップするためこの問題が出にくいですが、
nix-eval-jobsにはその仕組みがありません。

### 回避策: Flake URLでシステムを限定する

評価対象を現在のシステムに限定することで回避できます。

```bash
nix-fast-build --flake ".#checks.$(nix eval --raw --impure --expr builtins.currentSystem)" --no-link --skip-cached
```

`--impure`が必要ですが、
`builtins.currentSystem`を取得するだけなので実害はありません。

## オプション

`nix-fast-build --help`の順番に記載しています。

### `-f`, `--flake FLAKE`

評価・ビルド対象のFlake URLを指定します。
デフォルトは`.#checks`で、通常はそのままで問題ありません。

### `-j`, `--max-jobs MAX_JOBS`

同時に実行するビルドジョブの最大数です。
0を指定すると無制限になります。
基本的にデフォルトで問題ありません。

これはNixデーモンの`max-jobs`とは別の制御です。
nix-fast-buildがビルドキューから同時にディスパッチするジョブ数を制限します。

### `--option name value`

Nixの設定オプションを指定します。
`nix build --option`と同じ形式です。

#### `--option eval-cache false`

よく使う例です。
評価キャッシュを無効化します。

評価キャッシュはSQLiteで管理されており、
並列評価時にビジー状態の警告が出ることがあります。
煩わしい場合は無効化してください。

### `--remote-ssh-option name value`

リモートマシンへのSSH接続オプションを指定します。

### `--cachix-cache CACHIX_CACHE`

アップロード先のCachixキャッシュ名を指定します。

### `--attic-cache ATTIC_CACHE`

アップロード先のAtticキャッシュ名を指定します。

### `--no-nom`

[nom](https://github.com/maralorn/nix-output-monitor)
によるビルド出力の表示を無効化します。
デフォルトはfalse(nomを使用する)です。

nomはターミナルの制御シーケンスを使ったリッチな出力を行うため、
ターミナルではない環境(CIのログ、パイプ、非対話シェル等)では表示が崩れます。
そのような環境では指定してください。

### `--systems SYSTEMS`

ビルド対象のシステムをスペース区切りで指定します。
デフォルトは現在のシステムで、通常はそのままで問題ありません。

例: `--systems "x86_64-linux aarch64-linux"`

### `--retries RETRIES`

ビルド失敗時のリトライ回数です。
基本的にデフォルトで問題ありません。

### `--no-link`

ビルド後の`result`シンボリックリンクを作成しません。
デフォルトはfalse(リンクを作成する)です。

checksのビルドでは大量のシンボリックリンクが作成されて煩わしいため、
指定することを推奨します。

名前から「リンクしない = ビルドしない」と誤解しないでください。
ビルドは実行され、出力リンクの作成だけがスキップされます。

### `--out-link OUT_LINK`

出力リンクの名前を指定します。
デフォルトは`result`です。
基本的にデフォルトで問題ありません。

### `--remote REMOTE`

ビルドを実行するリモートマシンのSSHホスト名です。
リモート側で評価とビルドを行い、結果をローカルに転送します。

### `--always-upload-source`

ソースを常にリモートマシンにアップロードします。
デフォルトはfalse(アップロードしない)です。

リモートマシンがソースリポジトリにアクセスできない場合に必要です。

### `--no-download`

リモートビルドの結果をローカルにダウンロードしません。

CIでリモートビルドしてキャッシュにアップロードするだけの場合に使います。

### `--skip-cached`

バイナリキャッシュに既に存在するビルドをスキップします。
デフォルトはfalse(スキップしない)です。

名前から「ローカルのストアにあればスキップ」と誤解されがちですが、
チェック対象はバイナリキャッシュ(substituter)です。
キャッシュに既にあるものを再ビルドしたくない場合に有用です。

### `--copy-to COPY_TO`

ビルド結果を指定パスにコピーします。
`nix copy`に渡される形式で指定します。

例: `--copy-to "file:///tmp/cache?compression=none"`

### `--debug`

デバッグログを出力します。
基本的にデフォルトで問題ありません。

### `--eval-max-memory-size EVAL_MAX_MEMORY_SIZE`

`nix-eval-jobs`の評価ワーカー1つあたりのメモリ上限(MiB)です。
上限に達するとワーカーが再起動されます。

大きなFlakeで評価中にOOMが発生する場合に調整します。
基本的にデフォルトで問題ありません。

### `--eval-workers EVAL_WORKERS`

評価スレッドの数です。
`nix-eval-jobs`が生成する並列評価ワーカーの数を制御します。
基本的にデフォルトで問題ありません。

### `--result-file RESULT_FILE`

ビルド結果を書き出すファイルパスです。

### `--result-format {json,junit}`

ビルド結果ファイルの形式です。
`json`または`junit`を選択できます。

CIでテスト結果として扱いたい場合は`junit`が便利です。

### `--override-input input_path flake_url`

特定のFlake入力をオーバーライドします。
`nix build --override-input`と同じ形式です。

例: `--override-input nixpkgs github:NixOS/nixpkgs/nixpkgs-unstable`
