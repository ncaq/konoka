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
- `mypy`
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
    my-custom-linter = {
      command = "${pkgs.bash}/bin/bash";
      options = [
        "-euc"
        ''
          for file in "$@"; do
            # ここにカスタム処理
          done
        ''
        "--"
      ];
      includes = [ "*.ext" ];
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

`includes`/`excludes`のglobパターンはファイル名のみに対してマッチします。
`src/*.rs`のようなディレクトリを含むパターンは機能しません。
`*.rs`のように拡張子だけで指定してください。
ディレクトリ単位の除外はグローバルの`settings.global.excludes`で行います。

treefmtのフォーマッタ仕様を満たす必要があります。
CLIが`<command> [options] [...<files>]`の形式で、変更があればファイルに書き戻し、エラー時は非ゼロ終了です。
仕様を満たさないツールはシェルスクリプトでラップしてください。
