---
name: treefmt
description: treefmt-nix and nix fmt guide. Unified formatting and linting with treefmt. Use when configuring or running nix fmt, treefmt, or adding formatters/linters to a Nix project.
user-invocable: false
---

# treefmt-nix

[treefmt](https://github.com/numtide/treefmt)は、
プロジェクト内の複数の言語のファイルを、1つのコマンドで並列にフォーマットするツールです。
[treefmt-nix](https://github.com/numtide/treefmt-nix)は、
treefmtをNixのモジュールシステムで設定するラッパーです。
flakeに組み込むと`formatter`出力がtreefmtになり、
`nix fmt`で、設定した全てのプログラムが実行されます。

## 未追跡のファイルを先に登録する

flakeはGitが追跡しているファイルだけを対象にします。
未追跡の新しいファイルがある場合は、`nix fmt`の前に以下を実行してください。
未追跡のファイルが無くて入力が空でも、エラーにはなりません。

```bash
git ls-files --others --exclude-standard -z | git add --intent-to-add --pathspec-from-file=- --pathspec-file-nul
```

## フォーマッタだけでなくリンターも実行する

`nix fmt`や`treefmt`という名前から、フォーマッタしか実行しないと誤解しやすいですが、
treefmt-nixの`programs`にはリンターやチェッカーも多く含まれています。

treefmtがプログラムに求める仕様は、
`<command> [options] [...<files>]`の形でファイルのパスの一覧を受け取り、
変更があればファイルに書き戻し、エラーのときは非ゼロで終了することです。
リンターはファイルを変更しませんが、
エラーのときに非ゼロで終了するので、treefmtがエラーとして検出します。

## 設定の例

flake-partsを使う場合の例です。
`flake-parts.lib.mkFlake`に渡すモジュールのうち、treefmtに関わる部分だけを示します。

```nix
{
  imports = [ treefmt-nix.flakeModule ];

  perSystem =
    { pkgs, ... }:
    {
      treefmt.config = {
        projectRootFile = "flake.nix";
        programs = {
          nixfmt.enable = true;
          prettier.enable = true;
          shellcheck.enable = true;
          shfmt.enable = true;
        };
        settings.formatter.editorconfig-checker = {
          command = pkgs.editorconfig-checker;
          includes = [ "*" ];
        };
      };
    };
}
```

## ツールの設定は、そのツールの設定ファイルに書く

treefmtの設定モジュールでツールに引数を渡すこともできますが、
ツールの設定はなるべくflake.nixではなく、そのツールが標準で読む設定ファイルに書いてください。
`nix fmt`を経由せずにそのツールを使うときにも、同じ設定が適用されるためです。
引数でしか設定できないツールの場合は、flake.nixに書いて構いません。

## よく使われるプログラム

| 対象                                  | フォーマッタ                            | リンター、チェッカー                  |
| ------------------------------------- | --------------------------------------- | ------------------------------------- |
| Nix                                   | `nixfmt`                                | `deadnix`, `statix`(自動修正もします) |
| シェルスクリプト                      | `shfmt`                                 | `shellcheck`                          |
| JS/TS/CSS/HTML/JSON/Markdown/YAMLなど | `prettier`                              |                                       |
| Haskell                               | `fourmolu`, `cabal-gild`(Cabalファイル) | `hlint`                               |
| C/C++                                 | `clang-format`                          |                                       |
| Go                                    | `gofmt`                                 |                                       |
| Python                                | `ruff-format`                           | `ruff-check`                          |
| Rust                                  | `rustfmt`                               |                                       |
| TOML                                  | `taplo`                                 |                                       |
| YAML                                  | `yamlfmt`                               |                                       |
| GitHub Actions                        |                                         | `actionlint`, `zizmor`(セキュリティ)  |
| ソースコード全般                      |                                         | `typos`(スペルチェック)               |

これらは一部で、100以上のプログラムが定義されています。
全ての一覧は[treefmt-nixのprogramsディレクトリ](https://github.com/numtide/treefmt-nix/tree/main/programs)にあります。

## `programs`に無いツールの追加

`programs`に定義されていないツールは、
上の例の`editorconfig-checker`のように`settings.formatter.<name>`に直接定義します。

| フィールド | 型                     | 説明                                        |
| ---------- | ---------------------- | ------------------------------------------- |
| `command`  | string/path/derivation | 実行するコマンド(必須)                      |
| `options`  | list of string         | コマンドに渡す引数                          |
| `includes` | list of string         | 対象にするファイルのglobパターン(必須)      |
| `excludes` | list of string         | 除外するファイルのglobパターン              |
| `priority` | int                    | 実行の順序(値が小さいほど先、デフォルトは0) |

追加するツールは、前述のtreefmtの仕様を満たす必要があります。
満たさないツールはシェルスクリプトで包んでください。

globパターンは[gobwas/glob](https://github.com/gobwas/glob)で処理され、
ツリーのルートからの相対パスと照合されます。

- `*`は、パスの区切りの`/`も含む任意の文字列に一致します。
  `*.rs`だけで、リポジトリ全体の`.rs`ファイルに再帰的に一致します。
- `src/*.rs`のようにディレクトリを含むパターンも使えて、
  `src/`以下の全ての`.rs`ファイルに再帰的に一致します。
- `**`も使えますが、`*`と実質的に同じ動作です。

全てのフォーマッタに共通する除外は、
`settings.excludes`(改名前の名前は`settings.global.excludes`)に書きます。
この除外は、各フォーマッタの`includes`と`excludes`より先に処理されます。
