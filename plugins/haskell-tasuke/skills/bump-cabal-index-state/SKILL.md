---
name: bump-cabal-index-state
description: Update Cabal project index-state to the latest timestamp. Use when it needs to bump the cabal index-state.
allowed-tools: >-
  Bash(cabal build:*),
  Bash(cabal update:*),
  Bash(gh pr create:*),
  Bash(git add:*),
  Bash(git commit:*),
  Bash(git push:*),
  Bash(git remote:*),
  Bash(git status:*),
  Bash(git switch:*),
  Bash(nix flake check:*),
  Edit,
  Glob,
  Grep,
  Read
effort: medium
---

cabalプロジェクトの`index-state`を最新に更新します。
動作確認が成功したらコミットし、GitHubを利用している場合はプルリクエストも作成します。

# ブランチの作成

プルリクエストの作成に備えてブランチを作成します。

```bash
git switch -c bump-cabal-index-state
```

# cabal updateの実行

```bash
cabal update
```

出力の`The index-state is set to`の行から、最新の`index-state`のタイムスタンプを取得します。

```console
Downloading the latest package list from hackage.haskell.org
Package list of hackage.haskell.org is up to date.
The index-state is set to 2026-01-11T09:48:01Z.
```

# index-stateの更新

`index-state`は通常は`cabal.project`に`index-state: YYYY-MM-DDTHH:mm:ssZ`の形式で書かれています。
この日時を、取得したタイムスタンプに書き換えます。

`index-state:`と日時の間に、`hackage.haskell.org`のようなドメインの指定が入っていることも稀にあります。

`cabal.project`に書かれていない場合は、
`cabal.project.local`や`flake.nix`などに書かれていることがあるので、探して更新します。

# 動作確認

Nixを使用しているプロジェクトでは、以下のコマンドを実行します。

```bash
nix flake check
```

Nixを使用していないプロジェクトでは、以下のコマンドを実行します。

```bash
cabal build --disable-optimization --enable-tests all
```

## haskell.nixを使用している場合の遅れへの対応

haskell.nixは最新の`index-state`への対応が遅れるので、
最新の`index-state`を指定すると以下のようなエラーになることがあります。

```console
> Error: [Cabal-7159]
> Latest known index-state for 'hackage.haskell.org' (2026-01-05T23:03:18Z) is older than the requested index-state (2026-01-11T18:45:48Z).
> Run 'cabal update' or set the index-state to a value at or before 2026-01-05T23:03:18Z.
```

このエラーが出た場合は、エラーメッセージに表示されている、
haskell.nixが認識している最新の値(この例では`2026-01-05T23:03:18Z`)に`index-state`を書き換えて、
もう一度動作確認を行います。

# コミット

動作確認が成功したらコミットします。
成功しなかった場合は、コミットせずに完了報告へ進みます。

コミットメッセージのタイトルは`build(deps): cabalのindex-stateを更新`です。
本文は以下のテンプレートから作ります。

```markdown
`cabal.project`の`index-state`を`YYYY-MM-DDTHH:mm:ssZ`に更新しました。
```

- `cabal.project`は、実際に更新したファイル名に置き換えます。
- `YYYY-MM-DDTHH:mm:ssZ`は、新しい`index-state`に置き換えます。
- ドメインの指定がある場合は、`index-state`の前に、
  更新したドメイン(`hackage.haskell.org`など)をスペースで囲んで追加します。

# プルリクエストの作成

以下のコマンドで、GitHubを利用しているかを確認します。
GitHubを利用していない場合は、この手順を飛ばします。

```bash
git remote --verbose
```

GitHubを利用している場合は、リモートリポジトリにプッシュしてから、プルリクエストを作成します。

```bash
git push --verbose --set-upstream origin
```

```bash
gh pr create --assignee @me --fill --label "Type: Dependencies" --title "build(deps): cabalのindex-stateを更新"
```

# 完了報告

以下を報告します。

- 動作確認が成功したか
- 更新前の`index-state`
- 更新後の`index-state`
- haskell.nixを使用している場合は、haskell.nixが認識している最新の`index-state`が、
  cabalの最新の`index-state`に比べてどれくらい遅れているか
- プルリクエストを作成した場合は、そのURL
