---
name: nix-fast-build
description: nix-fast-build command reference. Parallel Nix evaluation and build tool using nix-eval-jobs. Use when running or configuring nix-fast-build.
user-invocable: false
---

# nix-fast-build

[Mic92/nix-fast-build](https://github.com/Mic92/nix-fast-build)は、
[nix-eval-jobs](https://github.com/nix-community/nix-eval-jobs)と
[nix-output-monitor](https://github.com/maralorn/nix-output-monitor)(nom)を組み合わせて、
Nix式の評価を並列に実行してビルドするツールです。
デフォルトではFlakeの`checks`をビルドするので、
`flake.nix`が適切に設定されていれば、リントとビルドとテストが全て実行されます。
評価が並列化されるので`nix flake check`より高速です。

## 実行方法

手元のターミナルでは以下で実行します。

```bash
nix-fast-build --option eval-cache false --no-link --skip-cached
```

Claude CodeやCIのような非対話環境では`--no-nom`を追加します。

```bash
nix-fast-build --option eval-cache false --no-link --skip-cached --no-nom
```

- `--option eval-cache false`: 評価キャッシュを無効にします。
  評価キャッシュはSQLiteで管理されていて、
  並列に評価するとビジー状態の警告が出て煩わしいことがあるためです。
- `--no-link`: `result`シンボリックリンクを作りません。
  checksをビルドすると大量のシンボリックリンクが作られて煩わしいためです。
  省かれるのはリンクの作成だけで、ビルドは実行されます。
- `--skip-cached`: バイナリキャッシュ(substituter)に既にあるビルドをスキップします。
  ローカルのストアにあるかどうかを調べるオプションではありません。
- `--no-nom`: nomによるビルド出力の表示を無効にします。
  nomはターミナルの制御シーケンスを使ったリッチな出力をするので、
  CIのログ、パイプ、非対話シェルのようなターミナルではない環境では表示が崩れます。

## 新規ファイルがある場合

FlakeはGitで追跡されているファイルだけを対象にします。
新規ファイルがある場合は、nix-fast-buildを実行する前に以下のコマンドで追跡対象にしてください。
未追跡のファイルが無く入力が空でも、このコマンドはエラーになりません。

```bash
git ls-files --others --exclude-standard -z | git add --intent-to-add --pathspec-from-file=- --pathspec-file-nul
```

## IFDを使うプロジェクト

`--systems`はビルド対象を絞るだけで、評価は全てのアーキテクチャに対して行われます。
IFD(Import From Derivation)は評価の段階でderivationのビルドを要求するので、
ローカルでビルドできないアーキテクチャのIFDが走ってエラーになることがあります。
`nix flake check`はNix 2.16以降、
デフォルトで他のシステムの評価をスキップするのでこの問題が出にくいですが、
nix-eval-jobsにはその仕組みがありません。

`--flake`で評価対象を現在のシステムに限定すると回避できます。

```bash
nix-fast-build --flake ".#checks.$(nix eval --raw --impure --expr builtins.currentSystem)" --no-link --skip-cached
```

`--impure`が必要ですが、`builtins.currentSystem`を取得するだけなので実害はありません。

## その他のオプション

以下のオプションを含め、基本的にデフォルトのままで問題ありません。

- `-j`, `--max-jobs`: nix-fast-buildがビルドキューから同時にディスパッチするジョブ数の上限です。
  Nixデーモンの`max-jobs`とは別の制御です。
- `--systems`: ビルド対象のシステムを、スペース区切りの1つの引数で指定します。
  デフォルトは現在のシステムです。
  例: `--systems "x86_64-linux aarch64-linux"`
- `--remote`: 指定したSSHホストで評価とビルドを行い、結果をローカルに転送します。
  リモートマシンがソースリポジトリにアクセスできない場合は`--always-upload-source`を付けます。
  CIでリモートビルドしてキャッシュにアップロードするだけの場合は、`--no-download`で転送を省きます。
- `--eval-max-memory-size`: nix-eval-jobsの評価ワーカー1つあたりのメモリ上限(MiB)です。
  上限に達したワーカーは再起動されます。
  大きなFlakeで評価中にOOMが発生する場合に調整します。
- `--result-file`, `--result-format`: ビルド結果をファイルに書き出します。
  CIでテスト結果として扱う場合は`--result-format junit`が便利です。

キャッシュへのアップロード(`--cachix-cache`、`--attic-cache`、`--copy-to`)や
Flake入力の上書き(`--override-input`)など、
ここに無いオプションは`nix-fast-build --help`で確認してください。
