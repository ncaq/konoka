---
name: treefmt
description: treefmt-nix and nix fmt guide. Unified formatting and linting with treefmt. Use when configuring or running nix fmt, treefmt, or adding formatters/linters to a Nix project.
user-invocable: false
---

# treefmt-nix

## 概要

[treefmt](https://github.com/numtide/treefmt)はプロジェクト内の複数言語ファイルを一コマンドで並列フォーマットするツールです。
[treefmt-nix](https://github.com/numtide/treefmt-nix)はNixモジュールシステムでtreefmtを設定・管理するラッパーです。

`nix fmt`コマンドはflakeの`formatter`出力を呼び出します。
treefmt-nixを組み込むと`nix fmt`の実体がtreefmtになり、
設定されたすべてのプログラムが実行されます。

FlakeはGitで追跡されているファイルのみを対象とするため、
新規ファイルがある場合は事前に`git ls-files --others --exclude-standard -z | git add --intent-to-add --pathspec-from-file=- --pathspec-file-nul`を実行してください。
未追跡ファイルがなく空の入力でもエラーにはなりません。

## フォーマッタだけではなくリンターも含む

`nix fmt`や`treefmt`という名前から「フォーマッタだけ」と誤解されがちですが、
treefmt-nixの`programs`にはリンターやチェッカーが多数含まれています。

フォーマッタの例:

- `nixfmt`
- `prettier`
- `rustfmt`
- `shfmt`

リンターの例:

- `actionlint`
- `deadnix`
- `hlint`
- `shellcheck`
- `statix`

その他:

- `typos`(スペルチェック)
- `zizmor`(GitHub Actionsセキュリティ)

treefmtのフォーマッタ仕様は「ファイルパスのリストを受け取り、変更があればファイルに書き戻す」というものです。
リンターはファイルを変更しませんが、エラー時に非ゼロ終了するためtreefmtがエラーとして検出します。

## 典型的な設定例

flake-partsを使う場合の例です。

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = inputs: {
    # flake-partsでtreefmt-nix.flakeModuleをimport
    imports = [ inputs.treefmt-nix.flakeModule ];

    perSystem = { pkgs, ... }: {
      treefmt.config = {
        projectRootFile = "flake.nix";
        programs = {
          nixfmt.enable = true;
          prettier.enable = true;
          shellcheck.enable = true;
          shfmt.enable = true;
        };
      };
    };
  };
}
```

`nix fmt`で全プログラムが実行されます。

## フォーマッタのカスタム設定をする際の注意

treefmtの設定モジュールを使ってカスタム引数を渡すこともできます。

しかしなるべくflake.nixに書くのではなく、
そのツール自体が標準的に使う設定ファイルなどに設定を書き込んでください。

そうするとそのツールを`nix fmt`経由以外で使うときも同じ設定が適用されるため一貫性が保たれます。

引数しか設定方法がないツールの場合などは仕方がないのでflake.nixに書いても構いません。

## よく使われるプログラム

### Nix

| プログラム | 種類         | 説明                           |
| ---------- | ------------ | ------------------------------ |
| `deadnix`  | リンター     | 未使用コードの検出             |
| `nixfmt`   | フォーマッタ | 公式のNixフォーマッタ          |
| `statix`   | リンター     | アンチパターンの検出と自動修正 |

### シェル

| プログラム   | 種類         | 説明                           |
| ------------ | ------------ | ------------------------------ |
| `shellcheck` | リンター     | シェルスクリプトの静的解析     |
| `shfmt`      | フォーマッタ | シェルスクリプトのフォーマット |

### Web/汎用

| プログラム | 種類         | 説明                                |
| ---------- | ------------ | ----------------------------------- |
| `prettier` | フォーマッタ | JS/TS/CSS/HTML/JSON/Markdown/YAML等 |

### Haskell

| プログラム   | 種類         | 説明                          |
| ------------ | ------------ | ----------------------------- |
| `cabal-gild` | フォーマッタ | Cabalファイルの整理           |
| `fourmolu`   | フォーマッタ | Haskellフォーマッタ           |
| `hlint`      | リンター     | Haskellのリファクタリング提案 |

### その他

| プログラム     | 種類         | 説明                                 |
| -------------- | ------------ | ------------------------------------ |
| `actionlint`   | リンター     | GitHub Actions YAMLの検証            |
| `clang-format` | フォーマッタ | C/C++のフォーマット                  |
| `gofmt`        | フォーマッタ | Goのフォーマット                     |
| `ruff-check`   | リンター     | Pythonのリント                       |
| `ruff-format`  | フォーマッタ | Pythonのフォーマット                 |
| `rustfmt`      | フォーマッタ | Rustのフォーマット                   |
| `taplo`        | フォーマッタ | TOMLのフォーマット                   |
| `typos`        | チェッカー   | ソースコード中のスペルチェック       |
| `yamlfmt`      | フォーマッタ | YAMLのフォーマット                   |
| `zizmor`       | リンター     | GitHub Actionsのセキュリティチェック |

上記は一部で、100以上のプログラムが定義されています。
全リストは[treefmt-nixのprogramsディレクトリ](https://github.com/numtide/treefmt-nix/tree/main/programs)を参照してください。

## カスタムプログラムの追加

`programs`に定義されていないツールは`settings.formatter`に直接定義できます。

```nix
treefmt.config = {
  settings.formatter = {
    editorconfig-checker = {
      command = pkgs.editorconfig-checker;
      includes = [ "*" ];
    };
  };
};
```

`settings.formatter.<name>`のフィールド:

| フィールド | 型                     | 説明                                    |
| ---------- | ---------------------- | --------------------------------------- |
| `command`  | string/path/derivation | 実行コマンド(必須)                      |
| `options`  | list of string         | コマンド引数                            |
| `includes` | list of string         | 対象ファイルのglobパターン(必須)        |
| `excludes` | list of string         | 除外ファイルのglobパターン              |
| `priority` | int                    | 実行順序(値が小さいほど先、デフォルト0) |

globパターンは[gobwas/glob](https://github.com/gobwas/glob)ライブラリで処理され、
ツリールートからの相対パスに対してマッチします。
`*`はパス区切り`/`を含む任意の文字列にマッチするため、`*.rs`だけでリポジトリ全体の`.rs`ファイルに再帰的にマッチします。
`src/*.rs`のようなディレクトリを含むパターンも機能し、`src/`以下の全`.rs`ファイルに再帰的にマッチします。
`**`も使えますが`*`と実質同じ動作です。

`settings.global.excludes`を使うと全フォーマッタ共通でファイルを除外できます。
global excludesは各フォーマッタのincludes/excludesより先に処理されます。

treefmtのフォーマッタ仕様を満たす必要があります。
CLIが`<command> [options] [...<files>]`の形式で、変更があればファイルに書き戻し、エラー時は非ゼロ終了です。
仕様を満たさないツールはシェルスクリプトでラップしてください。
